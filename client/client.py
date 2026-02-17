# client/client.py
from .connection.client_connection import setup_connection
from .connection.message_sender import MessageSender
from .messages.messages import start_receiving
from .ui import get_username, prompt_message


class ChatClient:
    """Classe principal do cliente de chat."""

    def __init__(self):
        self.client = setup_connection()       # Conexão com o servidor
        self.username = None                   # Nome do usuário
        self.sender = None                     # Envio de mensagens
        self.receiver_thread = None            # Thread de recebimento

    def login(self):
        """Realiza login: pega nome e inicia thread de recebimento."""
        self.username = get_username()
        self.client.send(self.username.encode("utf-8"))

        # Inicializa o MessageSender
        self.sender = MessageSender(self.client, self.username)

        # Inicia a thread de recebimento
        self.receiver_thread = start_receiving(self.client)

        print(f"Conectado ao servidor. Digite suas mensagens (ou !sair para sair):")

    def send_message(self, msg: str):
        """Envia mensagem usando o MessageSender."""
        self.sender.send(msg)

    def input_loop(self):
        """Loop principal de input do usuário."""
        while True:
            msg = prompt_message(self.username)
            if msg.lower() == "!sair":
                self.disconnect()
                break
            self.send_message(msg)

    def disconnect(self):
        """Encerra a conexão e imprime mensagem de saída."""
        print(f"*** {self.username} saiu do chat! ***")
        if self.receiver_thread:
            self.receiver_thread.stop()
        self.client.close()

    def run(self):
        """Roda o chat: login + loop de input."""
        self.login()
        self.input_loop()


# Entry point
if __name__ == "__main__":
    chat = ChatClient()
    chat.run()
