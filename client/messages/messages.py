# client/messages/messages.py
import threading

class ReceiverThread(threading.Thread):
    """Thread para receber mensagens do servidor."""

    def __init__(self, client_socket):
        super().__init__(daemon=True)
        self.client_socket = client_socket

    def run(self):
        while True:
            try:
                message = self.client_socket.recv(1024)
                if message:
                    print("\n" + message.decode("utf-8"))
            except:
                continue

def start_receiving(client_socket):
    """Inicia a thread de recebimento de mensagens."""
    ReceiverThread(client_socket).start()
