# === Adjustable pricing factors ===
INPUT_TOKEN_PRICE = 0.0000010  # € per input token
OUTPUT_TOKEN_PRICE = 0.0000030  # € per output token
CURRENCY_SYMBOL = "€"

def calculate_audit_cost(input_tokens: int, output_tokens: int) -> dict:
    input_cost = input_tokens * INPUT_TOKEN_PRICE
    output_cost = output_tokens * OUTPUT_TOKEN_PRICE
    total_cost = input_cost + output_cost

    return {
        "Input Cost": f"{CURRENCY_SYMBOL}{input_cost:.4f}",
        "Output Cost": f"{CURRENCY_SYMBOL}{output_cost:.4f}",
        "Total Cost": f"{CURRENCY_SYMBOL}{total_cost:.4f}"
    }

# === Example usage ===
audit_tokens = {
    "input": 12300,
    "output": 4800
}

result = calculate_audit_cost(audit_tokens["input"], audit_tokens["output"])
for key, value in result.items():
    print(f"{key}: {value}")

# === tweak INPUT_TOKEN_PRICE, OUTPUT_TOKEN_PRICE, or CURRENCY_SYMBOL to match the model or pricing plan you're testing. …