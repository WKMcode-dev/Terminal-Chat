# client/messages/utils.py

def format_message(username: str, msg: str) -> str:
    """Formata a mensagem com o nome do usuário."""
    return f"[{username}]: {msg}"
