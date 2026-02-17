# client/ui.py
from prompt_toolkit import PromptSession
from prompt_toolkit.patch_stdout import patch_stdout

session = PromptSession()

def get_username():
    return input("Digite seu nome: ")

def prompt_message(username: str):
    with patch_stdout():
        return session.prompt(f"[{username}]: ")
