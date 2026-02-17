# client/connection/message_sender.py
from ..messages.utils import format_message

class MessageSender:
    """Encapsula o envio de mensagens para o servidor."""

    def __init__(self, client_socket, username):
        self.client = client_socket
        self.username = username

    def send(self, msg: str):
        """Formata e envia a mensagem via socket."""
        self.client.send(format_message(self.username, msg).encode("utf-8"))
