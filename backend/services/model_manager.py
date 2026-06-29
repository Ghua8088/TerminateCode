import os
import gc
import requests
from typing import List, Dict, Any, Optional
from langchain_core.language_models import BaseChatModel

# Try to import necessary libraries, handle failures gracefully
try:
    from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
    GOOGLE_AVAILABLE = True
except ImportError:
    GOOGLE_AVAILABLE = False

try:
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    from langchain_anthropic import ChatAnthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

try:
    from langchain_community.chat_models import ChatLlamaCpp
    LLAMACPP_AVAILABLE = True
except ImportError:
    # Fix for bundled apps: llama-cpp-python might fail to find its DLLs
    try:
        if getattr(sys, 'frozen', False):
            bundle_dir = getattr(sys, '_MEIPASS', os.path.abspath(os.path.dirname(sys.executable)))
            # Try common locations in bundled app
            possible_lib_dirs = [
                os.path.join(bundle_dir, "_internal", "llama_cpp", "lib"),
                os.path.join(bundle_dir, "llama_cpp", "lib"),
                os.path.join(bundle_dir, "_internal", "llama_cpp"),
                os.path.join(bundle_dir, "llama_cpp"),
            ]
            for lib_dir in possible_lib_dirs:
                dll_path = os.path.join(lib_dir, "llama.dll")
                if os.path.exists(dll_path):
                    os.environ["LLAMA_CPP_LIB"] = dll_path
                    print(f"Found bundled llama.dll at: {dll_path}")
                    break
        from langchain_community.chat_models import ChatLlamaCpp
        LLAMACPP_AVAILABLE = True
    except Exception as e:
        print(f"LlamaCpp still not available after bundle fix: {e}")
        LLAMACPP_AVAILABLE = False

# Import keyring for secure storage access (same as settings.py)
try:
    import keyring
except ImportError:
    keyring = None

_KEYRING_SERVICE = "TerminateCode"
_KEYRING_USER_GOOGLE = "google_api_key"
_KEYRING_USER_OPENAI = "openai_api_key"
_KEYRING_USER_ANTHROPIC = "anthropic_api_key"
_KEYRING_USER_MISTRAL = "mistral_api_key"

# In-memory storage for API keys (fallback)
_server_api_keys = {
    "google": None,
    "openai": None,
    "anthropic": None,
    "mistral": None
}

# Cache for available models to speed up UI
_available_models_cache = {
    "local": [],
    "cloud": [],
    "last_updated": 0
}
CACHE_TTL = 300  # 5 minutes

def get_api_key(provider: str) -> Optional[str]:
    """Retrieve API key for a specific provider."""
    key_map = {
        "google": _KEYRING_USER_GOOGLE,
        "openai": _KEYRING_USER_OPENAI,
        "anthropic": _KEYRING_USER_ANTHROPIC,
        "mistral": _KEYRING_USER_MISTRAL
    }
    
    # Check environment variable first
    env_key = os.getenv(f"{provider.upper()}_API_KEY")
    if env_key:
        return env_key

    # Check keyring
    if keyring is not None:
        try:
            stored = keyring.get_password(_KEYRING_SERVICE, key_map.get(provider, ""))
            if stored:
                return stored
        except Exception:
            pass
            
    # Check in-memory fallback
    return _server_api_keys.get(provider)

def set_api_key_in_manager(provider: str, api_key: Optional[str]):
    """Update the in-memory API key for a provider."""
    if provider in _server_api_keys:
        _server_api_keys[provider] = api_key
        # Clear cache for this provider's models if necessary
        global _loaded_models_cache
        keys_to_remove = [k for k in _loaded_models_cache if k.startswith(provider) or (provider == "google" and k.startswith("gemini"))]
        for k in keys_to_remove:
            del _loaded_models_cache[k]
        return True
    return False

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
    import time
    global _available_models_cache
    
    # 1. Local GGUF models - always fresh as it's fast
    local_models = []
    try:
        global_models_dir = os.path.join(os.path.expanduser("~"), ".terminatecode", "models")
        local_models_dir = os.path.join(os.getcwd(), "models")
        
        for search_dir in [global_models_dir, local_models_dir]:
            if os.path.exists(search_dir):
                for f in os.listdir(search_dir):
                    if f.endswith(('.gguf', '.bin')):
                        if f not in local_models: local_models.append(f)
    except: pass
    
    _available_models_cache["local"] = local_models

    # 2. Cloud models - use cache if fresh
    now = time.time()
    if now - _available_models_cache["last_updated"] < CACHE_TTL and _available_models_cache["cloud"]:
        return local_models + _available_models_cache["cloud"]

    cloud_models = []
    
    def is_valid_key(k): 
        if not k: return False
        k_str = str(k).strip()
        return len(k_str) > 5 and not k_str.startswith("YOUR_")

    # Google Gemini
    try:
        gemini_key = get_api_key("google")
        if is_valid_key(gemini_key):
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            # Use a shorter timeout if possible or just handle exception
            for m in genai.list_models():
                if 'generateContent' in m.supported_generation_methods:
                    name = m.name.replace('models/', '')
                    if name not in cloud_models: cloud_models.append(name)
        else:
            for m in ["gemini-2.0-flash", "gemini-1.5-flash"]:
                if m not in cloud_models: cloud_models.append(m)
    except Exception as e:
        print(f"Gemini model list failed: {e}")
        for m in ["gemini-2.0-flash", "gemini-1.5-flash"]:
            if m not in cloud_models: cloud_models.append(m)

    # OpenAI
    try:
        openai_key = get_api_key("openai")
        if is_valid_key(openai_key):
            resp = requests.get("https://api.openai.com/v1/models", headers={"Authorization": f"Bearer {openai_key}"}, timeout=3)
            if resp.status_code == 200:
                for m in resp.json().get('data', []):
                    mid = m.get('id')
                    if mid.startswith(('gpt-', 'o1-', 'o3-')) and mid not in cloud_models: cloud_models.append(mid)
            else:
                for m in ["gpt-4o", "gpt-4o-mini"]:
                    if m not in cloud_models: cloud_models.append(m)
    except Exception as e:
        print(f"OpenAI model list failed: {e}")

    # Anthropic
    for m in ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"]:
        if m not in cloud_models: cloud_models.append(m)
            
    _available_models_cache["cloud"] = cloud_models
    _available_models_cache["last_updated"] = now
    
    return local_models + cloud_models

def get_model_instance(model_name: str, temperature: float = 0.7) -> BaseChatModel:
    global current_model_name, _loaded_models_cache
    
    current_model_name = model_name
    cache_key = f"{model_name}_{temperature}"
    
    if cache_key in _loaded_models_cache:
        return _loaded_models_cache[cache_key]

    model = None
    
    try:
        if model_name.startswith("gemini"):
            if not GOOGLE_AVAILABLE:
                raise ImportError("langchain-google-genai not installed")
            key = get_api_key("google")
            if not key:
                raise ValueError("Google API Key not found")
            model = ChatGoogleGenerativeAI(model=model_name, google_api_key=key, temperature=temperature)
            
        elif model_name.startswith(("gpt-", "o1-")):
            if not OPENAI_AVAILABLE:
                raise ImportError("langchain-openai not installed")
            key = get_api_key("openai")
            if not key:
                raise ValueError("OpenAI API Key not found")
            model = ChatOpenAI(model=model_name, api_key=key, temperature=temperature)
            
        elif model_name.startswith("claude-"):
            if not ANTHROPIC_AVAILABLE:
                raise ImportError("langchain-anthropic not installed")
            key = get_api_key("anthropic")
            if not key:
                raise ValueError("Anthropic API Key not found")
            model = ChatAnthropic(model=model_name, anthropic_api_key=key, temperature=temperature)
            
        elif model_name.endswith(('.gguf', '.bin')):
            if not LLAMACPP_AVAILABLE:
                raise ImportError("llama-cpp-python or langchain-community not installed")
            
            # Locate the model file (check global first, then local)
            global_path = os.path.join(os.path.expanduser("~"), ".terminatecode", "models", model_name)
            local_path = os.path.join(os.getcwd(), "models", model_name)
            
            model_path = global_path if os.path.exists(global_path) else local_path
            
            if not os.path.exists(model_path):
                 raise FileNotFoundError(f"Model file not found: {model_name} (checked global and local)")
            
            # LlamaCpp specific parameters for speed optimization
            import multiprocessing
            threads = max(1, multiprocessing.cpu_count() - 2)
            
            model = ChatLlamaCpp(
                model_path=model_path,
                temperature=temperature,
                n_ctx=4096,
                max_tokens=2048,
                n_batch=512,       # Faster prompt processing
                n_threads=threads, # Use optimal CPU threads
                n_gpu_layers=-1,   # Try to use all layers on GPU if available
                f16_kv=True,       # Use half-precision for key-value cache
                streaming=True,
                verbose=False      # Less noise in logs
            )
        else:
            raise ValueError(f"Unknown model type: {model_name}")

        if model:
            _manage_cache(cache_key, model)
            return model

    except Exception as e:
        print(f"Error loading model {model_name}: {e}")
        raise e

def get_embeddings_instance(provider: str = "google"):
    """Retrieve an embeddings model instance for the specified provider."""
    try:
        if provider == "google":
            if not GOOGLE_AVAILABLE: return None
            key = get_api_key("google")
            if not key: return None
            return GoogleGenerativeAIEmbeddings(model="models/text-embedding-004", google_api_key=key)
        elif provider == "openai":
            if not OPENAI_AVAILABLE: return None
            key = get_api_key("openai")
            if not key: return None
            return OpenAIEmbeddings(api_key=key)
    except Exception as e:
        print(f"Error creating embedding instance: {e}")
    return None
