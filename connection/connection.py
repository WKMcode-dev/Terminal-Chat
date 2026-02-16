# connection.py
import socket

def connect_to_server(host: str, port: int = 5000) -> socket.socket:
    """Conecta ao servidor e retorna o socket conectado."""
    client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    client.connect((host, port))
    return client
