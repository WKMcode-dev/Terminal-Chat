# client/messages/messages.py
import threading

def start_receiving(client_socket):
    """Inicia uma thread que recebe mensagens do servidor."""
    def receive_messages():
        while True:
            try:
                message = client_socket.recv(1024)
                if message:
                    # Exibe mensagem acima do prompt
                    print("\n" + message.decode("utf-8"))
            except:
                continue

    threading.Thread(target=receive_messages, daemon=True).start()
