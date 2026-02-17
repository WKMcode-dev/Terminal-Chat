# client/ui.py
from prompt_toolkit import PromptSession
from prompt_toolkit.patch_stdout import patch_stdout

session = PromptSession()

def get_username():
    """Pede o nome do usuário."""
    return input("Digite seu nome: ")

def prompt_message(username: str):
    """Prompt interativo para digitar mensagens."""
    with patch_stdout():
        return session.prompt(f"[{username}]: ")
