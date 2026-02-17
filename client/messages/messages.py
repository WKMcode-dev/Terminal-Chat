# client/messages/messages.py
import threading


BUFFER_SIZE = 1024  # tamanho do buffer de recebimento

class ReceiverThread(threading.Thread):
    """Thread para receber mensagens do servidor com parada controlada e callback."""

    def __init__(self, client_socket, callback=None):
        """
        :param client_socket: socket do cliente
        :param callback: função opcional para processar mensagens recebidas
        """
        super().__init__(daemon=True)
        self.client_socket = client_socket
        self.callback = callback
        self.running = True  # flag de execução

    def stop(self):
        """Para a thread de forma controlada."""
        self.running = False

    def run(self):
        while self.running:
            try:
                message = self.client_socket.recv(BUFFER_SIZE)
                if message:
                    decoded = message.decode("utf-8")
                    if self.callback:
                        self.callback(decoded)
                    else:
                        print("\n" + decoded)
            except (OSError, ConnectionResetError):
                break  # encerra a thread se a conexão cair


def start_receiving(client_socket, callback=None):
    """
    Inicia a thread de recebimento de mensagens.

    :param client_socket: socket do cliente
    :param callback: função opcional para processar mensagens recebidas
    :return: instância da ReceiverThread
    """
    thread = ReceiverThread(client_socket, callback)
    thread.start()
    return thread
