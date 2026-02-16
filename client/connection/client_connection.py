# client/connection/client_connection.py
from connection.connection import connect_to_server

def setup_connection():
    """Pergunta o host e conecta ao servidor, retornando o socket."""
    host = input("Digite o IP do servidor (ex: 127.0.0.1 ou Radmin VPN IP): ")
    return connect_to_server(host)
