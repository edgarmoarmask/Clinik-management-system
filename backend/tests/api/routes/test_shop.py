import random
import string

from fastapi.testclient import TestClient

from app.core.config import settings

API = settings.API_V1_STR


def create_product(
    client: TestClient, headers: dict[str, str], **overrides: object
) -> dict:
    sku = "".join(random.choices(string.ascii_uppercase, k=10))
    data = {"sku": sku, "name": f"Product {sku}", "price": "12.50", "stock": 5}
    response = client.post(f"{API}/products", headers=headers, json=data | overrides)
    assert response.status_code == 201
    return response.json()


def test_normal_user_cannot_create_product(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    response = client.post(
        f"{API}/products",
        headers=normal_user_token_headers,
        json={"sku": "X1", "name": "X", "price": "1.00"},
    )
    assert response.status_code == 403


def test_checkout_and_pay(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    normal_user_token_headers: dict[str, str],
) -> None:
    product = create_product(client, superuser_token_headers)
    headers = normal_user_token_headers
    client.delete(f"{API}/cart", headers=headers)

    response = client.post(
        f"{API}/cart/items",
        headers=headers,
        json={"product_id": product["id"], "quantity": 2},
    )
    assert response.status_code == 201
    assert response.json()["total"] == "25.00"

    response = client.post(f"{API}/cart/checkout", headers=headers)
    assert response.status_code == 201
    payment = response.json()
    assert payment["status"] == "pending"
    assert payment["amount"] == "25.00"

    stock = client.get(f"{API}/products/{product['id']}").json()["stock"]
    assert stock == 3

    # cart is emptied after checkout
    assert client.get(f"{API}/cart", headers=headers).json()["items"] == []

    response = client.post(
        f"{API}/payments/{payment['id']}/confirm",
        headers=headers,
        json={"success": True, "method": "card", "transaction_ref": "T-1"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "paid"
    assert response.json()["paid_at"] is not None

    payments = client.get(f"{API}/payments", headers=headers).json()
    assert payment["id"] in [p["id"] for p in payments["data"]]


def test_cancel_releases_stock(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    normal_user_token_headers: dict[str, str],
) -> None:
    product = create_product(client, superuser_token_headers, stock=4)
    headers = normal_user_token_headers
    client.delete(f"{API}/cart", headers=headers)
    client.post(
        f"{API}/cart/items",
        headers=headers,
        json={"product_id": product["id"], "quantity": 4},
    )
    payment = client.post(f"{API}/cart/checkout", headers=headers).json()

    response = client.post(f"{API}/payments/{payment['id']}/cancel", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"
    assert client.get(f"{API}/products/{product['id']}").json()["stock"] == 4
    # the cart is reopened with its items so the user can retry
    assert len(client.get(f"{API}/cart", headers=headers).json()["items"]) == 1
    client.delete(f"{API}/cart", headers=headers)


def test_checkout_rejects_insufficient_stock(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    normal_user_token_headers: dict[str, str],
) -> None:
    product = create_product(client, superuser_token_headers, stock=1)
    response = client.post(
        f"{API}/cart/items",
        headers=normal_user_token_headers,
        json={"product_id": product["id"], "quantity": 2},
    )
    assert response.status_code == 409


def test_manual_payment_and_summary(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    normal_user_token_headers: dict[str, str],
) -> None:
    before = client.get(f"{API}/payments/summary", headers=superuser_token_headers)
    paid_before = float(before.json()["total_paid"])

    response = client.post(
        f"{API}/payments",
        headers=superuser_token_headers,
        json={
            "amount": "40.00",
            "method": "cash",
            "account_code": "4050",
            "description": "Walk-in sale",
        },
    )
    assert response.status_code == 201
    payment = response.json()
    assert payment["cart_id"] is None
    assert payment["status"] == "paid"

    after = client.get(f"{API}/payments/summary", headers=superuser_token_headers)
    assert float(after.json()["total_paid"]) == paid_before + 40

    # normal users can neither record payments nor see other users' payments
    response = client.post(
        f"{API}/payments",
        headers=normal_user_token_headers,
        json={"amount": "1.00", "method": "cash", "account_code": "4050"},
    )
    assert response.status_code == 403
    response = client.get(
        f"{API}/payments/{payment['id']}", headers=normal_user_token_headers
    )
    assert response.status_code == 403


def test_expense_reduces_profit(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    before = client.get(f"{API}/payments/summary", headers=superuser_token_headers)
    before = before.json()

    response = client.post(
        f"{API}/payments",
        headers=superuser_token_headers,
        json={
            "amount": "15.00",
            "kind": "expense",
            "account_code": "6020",
            "method": "bank_transfer",
            "description": "Rent",
        },
    )
    assert response.status_code == 201
    assert response.json()["kind"] == "expense"

    after = client.get(f"{API}/payments/summary", headers=superuser_token_headers)
    after = after.json()
    assert float(after["total_expenses"]) == float(before["total_expenses"]) + 15
    assert float(after["total_paid"]) == float(before["total_paid"])
    assert float(after["profit"]) == float(before["profit"]) - 15


def test_batch_create_products(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    normal_user_token_headers: dict[str, str],
) -> None:
    prefix = "".join(random.choices(string.ascii_uppercase, k=6))
    batch = [
        {"sku": f"{prefix}-{i}", "name": f"Batch {i}", "price": "3.00", "stock": i}
        for i in range(3)
    ]
    response = client.post(
        f"{API}/products/batch", headers=superuser_token_headers, json=batch
    )
    assert response.status_code == 201
    assert [p["sku"] for p in response.json()] == [p["sku"] for p in batch]

    # an existing SKU rejects the whole batch
    new = {"sku": f"{prefix}-new", "name": "New", "price": "1.00"}
    response = client.post(
        f"{API}/products/batch",
        headers=superuser_token_headers,
        json=[new, batch[0]],
    )
    assert response.status_code == 409
    assert batch[0]["sku"] in response.json()["detail"]
    response = client.get(f"{API}/products", params={"q": "New"})
    assert new["sku"] not in [p["sku"] for p in response.json()]

    # SKUs repeated within the batch are rejected too
    response = client.post(
        f"{API}/products/batch", headers=superuser_token_headers, json=[new, new]
    )
    assert response.status_code == 409

    response = client.post(
        f"{API}/products/batch", headers=normal_user_token_headers, json=[new]
    )
    assert response.status_code == 403


def test_update_and_deactivate_product(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    product = create_product(client, superuser_token_headers)
    response = client.patch(
        f"{API}/products/{product['id']}",
        headers=superuser_token_headers,
        json={"price": "9.99", "stock": 7},
    )
    assert response.status_code == 200
    assert response.json()["price"] == "9.99"
    assert response.json()["stock"] == 7

    response = client.delete(
        f"{API}/products/{product['id']}", headers=superuser_token_headers
    )
    assert response.status_code == 204
    listed = client.get(f"{API}/products", params={"limit": 100}).json()
    assert product["id"] not in [p["id"] for p in listed]


def test_payment_account_must_match_kind(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    for kind, code in [
        ("income", "6020"),  # expense account on income
        ("expense", "4050"),  # revenue account on expense
        ("expense", "6000"),  # header account
        ("income", "9999"),  # unknown
        ("income", "1010"),  # asset
    ]:
        response = client.post(
            f"{API}/payments",
            headers=superuser_token_headers,
            json={"amount": "1.00", "method": "cash", "kind": kind, "account_code": code},
        )
        assert response.status_code == 422, (kind, code)


def test_profit_and_loss_report(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    headers = superuser_token_headers
    # a future window keeps other tests' payments out of the totals
    window = {"start": "2099-01-01T00:00:00Z", "end": "2099-02-01T00:00:00Z"}
    empty = client.get(f"{API}/accounting/profit-and-loss", headers=headers, params=window)
    assert empty.status_code == 200
    assert empty.json()["net_profit"] == "0"

    for kind, code, amount in [
        ("income", "4050", "100.00"),
        ("income", "4050", "50.00"),
        ("income", "4020", "30.00"),
        ("expense", "5010", "40.00"),
        ("expense", "6020", "25.00"),
    ]:
        r = client.post(
            f"{API}/payments",
            headers=headers,
            json={"amount": amount, "method": "cash", "kind": kind, "account_code": code},
        )
        assert r.status_code == 201

    report = client.get(f"{API}/accounting/profit-and-loss", headers=headers).json()
    revenue = {line["code"]: float(line["amount"]) for line in report["revenue"]}
    assert revenue["4050"] >= 150 and revenue["4020"] >= 30
    assert float(report["gross_profit"]) == float(report["total_revenue"]) - float(
        report["total_cost_of_sales"]
    )
    assert float(report["net_profit"]) == float(report["gross_profit"]) - float(
        report["total_expenses"]
    )

    accounts = client.get(f"{API}/accounting/accounts", headers=headers).json()
    assert any(a["code"] == "4050" and a["type"] == "REVENUE" for a in accounts)


def test_profit_and_loss_requires_cashier(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{API}/accounting/profit-and-loss", headers=normal_user_token_headers
    )
    assert r.status_code == 403
