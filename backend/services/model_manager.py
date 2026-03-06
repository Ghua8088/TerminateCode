import os
import gc
import requests
from typing import List, Dict, Any, Optional
from langchain_core.language_models import BaseChatModel



# Import keyring for secure storage access (same as settings.py)
try:
    import keyring
except ImportError:
    keyring = None

# Internal key storage to ensure immediate sync
API_KEYS = {
    "google": None,
    "openai": None,
    "anthropic": None,
    "mistral": None
}

def set_api_key_in_manager(provider: str, key: str):
    """Update a key in the manager's memory."""
    if provider in API_KEYS:
        API_KEYS[provider] = key

def get_api_key(provider: str) -> Optional[str]:
    """Retrieve API key for a specific provider with multi-level lookup."""
    # 1. Local memory (for immediate sync after updates)
    if API_KEYS.get(provider):
        return API_KEYS[provider]
        
    # 2. Environment variable
    env_key = os.getenv(f"{provider.upper()}_API_KEY")
    if env_key:
        return env_key

    # 3. Secure Keyring (Persistent across restarts)
    if keyring is not None:
        try:
            # Re-fetch from keyring directly to ensure we have latest
            key_map = {
                "google": "google_api_key",
                "openai": "openai_api_key",
                "anthropic": "anthropic_api_key",
                "mistral": "mistral_api_key"
            }
            stored = keyring.get_password("TerminateCode", key_map.get(provider, ""))
            if stored:
                API_KEYS[provider] = stored # Cache it
                return stored
        except Exception:
            pass
            
    return None

_loaded_models_cache = {}
MAX_CACHED_MODELS = 2
current_model_name = ""

def clear_model_cache():
    global _loaded_models_cache
    _loaded_models_cache.clear()
    gc.collect()
    return True

def _manage_cache(new_key, model_instance):
    global _loaded_models_cache
    if new_key not in _loaded_models_cache:
        if len(_loaded_models_cache) >= MAX_CACHED_MODELS:
            # Remove oldest
            oldest_key = next(iter(_loaded_models_cache))
            del _loaded_models_cache[oldest_key]
            gc.collect()
        _loaded_models_cache[new_key] = model_instance

def get_available_models() -> List[str]:
    models = []
    # 1. Local GGUF models
    try:
        # For TerminateCode, we'll check a 'models' folder in the current workspace
        models_dir = os.path.join(os.getcwd(), "models")
        if os.path.exists(models_dir):
            for f in os.listdir(models_dir):
                if f.endswith(('.gguf', '.bin')):
                    if f not in models: models.append(f)
    except: pass


    
    # Custom Providers (e.g. LiteLLM or other OpenAI-compatible proxies)
    # This section is kept for future expansion if you add a CUSTOM_PROVIDERS config
    
    # 3. Standard Cloud Models
    def is_valid_key(k): return k and len(k) > 10 and not k.startswith("YOUR_")

    # Google Gemini
    gemini_key = get_api_key("google")
    if is_valid_key(gemini_key):
        try:
            resp = requests.get(f"https://generativelanguage.googleapis.com/v1beta/models?key={gemini_key}", timeout=5)
            if resp.status_code == 200:
                for m in resp.json().get('models', []):
                    if 'generateContent' in m.get('supportedGenerationMethods', []):
                        name = m.get('name', '').replace('models/', '')
                        if name not in models: models.append(name)
        except:
            for m in ["gemini-2.0-flash", "gemini-2.0-pro-exp-02-05", "gemini-1.5-flash", "gemini-1.5-pro"]:
                if m not in models: models.append(m)

    # OpenAI
    openai_key = get_api_key("openai")
    if is_valid_key(openai_key):
        try:
            resp = requests.get("https://api.openai.com/v1/models", headers={"Authorization": f"Bearer {openai_key}"}, timeout=5)
            if resp.status_code == 200:
                for m in resp.json().get('data', []):
                    mid = m.get('id')
                    if mid.startswith(('gpt-', 'o1-', 'o3-')) and mid not in models: models.append(mid)
        except:
             for m in ["gpt-4o", "gpt-4o-mini"]:
                if m not in models: models.append(m)

    # Anthropic
    anthropic_key = get_api_key("anthropic")
    if is_valid_key(anthropic_key):
        for m in ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"]:
            if m not in models: models.append(m)
            
    return models

def get_embeddings_instance(provider: str = "google"):
    """Get an embedding model instance for vectorization."""
    try:
        if provider == "google":
            from langchain_google_genai import GoogleGenerativeAIEmbeddings
            key = get_api_key("google")
            if not key: return None
            return GoogleGenerativeAIEmbeddings(model="models/text-embedding-004", google_api_key=key)
            
        elif provider == "openai":
            from langchain_openai import OpenAIEmbeddings
            key = get_api_key("openai")
            if not key: return None
            return OpenAIEmbeddings(model="text-embedding-3-small", api_key=key)
            
    except Exception as e:
        print(f"Error loading {provider} embeddings: {e}")
    return None

def get_model_instance(model_name: str, temperature: float = 0.7) -> BaseChatModel:
    global current_model_name, _loaded_models_cache
    
    current_model_name = model_name
    cache_key = f"{model_name}_{temperature}"
    
    if cache_key in _loaded_models_cache:
        return _loaded_models_cache[cache_key]

    model = None
    
    try:
        if model_name.startswith("gemini"):
            from langchain_google_genai import ChatGoogleGenerativeAI
            key = get_api_key("google")
            if not key:
                raise ValueError("Google API Key not found")
            model = ChatGoogleGenerativeAI(model=model_name, google_api_key=key, temperature=temperature, streaming=True)
            
        elif model_name.startswith(("gpt-", "o1-")):
            from langchain_openai import ChatOpenAI
            key = get_api_key("openai")
            if not key:
                raise ValueError("OpenAI API Key not found")
            model = ChatOpenAI(model=model_name, api_key=key, temperature=temperature, streaming=True)
            
        elif model_name.startswith("claude-"):
            from langchain_anthropic import ChatAnthropic
            key = get_api_key("anthropic")
            if not key:
                raise ValueError("Anthropic API Key not found")
            model = ChatAnthropic(model=model_name, anthropic_api_key=key, temperature=temperature)
            
        elif model_name.endswith(('.gguf', '.bin')):
            from langchain_community.chat_models import ChatLlamaCpp
            
            # Locate the model file
            root_dir = os.getcwd()
            model_path = os.path.join(root_dir, "models", model_name)
            if not os.path.exists(model_path):
                 raise FileNotFoundError(f"Model file not found: {model_path}")
            
            # LlamaCpp specific parameters
            model = ChatLlamaCpp(
                model_path=model_path,
                temperature=temperature,
                n_ctx=4096,
                max_tokens=2000,
                n_gpu_layers=-1, # Try to use all layers on GPU if available
                verbose=True
            )
        else:
            raise ValueError(f"Unknown model type: {model_name}")

        if model:
            _manage_cache(cache_key, model)
            return model

    except Exception as e:
        print(f"Error loading model {model_name}: {e}")
        raise e
