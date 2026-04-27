import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Try to translate a simple word with different model names
test_text = "Hello"
target_lang = "Spanish"
prompt = f"Translate '{test_text}' to {target_lang}."

models_to_try = [
    'gemini-1.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash-latest',
    'gemini-2.0-flash-exp'
]

for model_name in models_to_try:
    print(f"Testing model: {model_name}...")
    try:
        response = client.models.generate_content(
            model=model_name,
            contents=prompt
        )
        print(f"SUCCESS with {model_name}: {response.text}")
        break
    except Exception as e:
        print(f"FAILED with {model_name}: {e}")

print("\nListing all models to be sure:")
try:
    for m in client.models.list():
        print(m.name)
except Exception as e:
    print(f"Error listing: {e}")
