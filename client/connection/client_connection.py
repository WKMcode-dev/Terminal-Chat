# client/connection/client_connection.py
import socket

def setup_connection():
    """Pergunta o host e conecta ao servidor, retornando o socket."""
    host = input("Digite o IP do servidor (ex: 127.0.0.1 ou Radmin VPN IP): ")

    client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    client.connect((host, 5000))

    return client

