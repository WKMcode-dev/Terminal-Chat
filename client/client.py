# client/client.py
from .connection.client_connection import setup_connection
from .messages.messages import start_receiving
from .messages.utils import format_message
from .ui import get_username, prompt_message

class ChatClient:
    def __init__(self):
        self.client = setup_connection()
        self.username = None

    def login(self):
        self.username = get_username()
        self.client.send(self.username.encode("utf-8"))
        start_receiving(self.client)
        print(f"Conectado ao servidor. Digite suas mensagens (ou !sair para sair):")

    def send_message(self, msg: str):
        self.client.send(format_message(self.username, msg).encode("utf-8"))

    def run(self):
        self.login()
        while True:
            msg = prompt_message(self.username)

            if msg.lower() == "!sair":
                print(f"*** {self.username} saiu do chat! ***")
                self.client.close()
                break

            self.send_message(msg)

# Entry point
if __name__ == "__main__":
    chat = ChatClient()
    chat.run()
