# client.py
from prompt_toolkit import PromptSession
from prompt_toolkit.patch_stdout import patch_stdout
from connection.connection import connect_to_server  # import da função modularizada
from .messages.messages import start_receiving       # import do módulo de mensagens
from .connection.client_connection import setup_connection  # import da função de configuração de conexão do client

# Conectar ao servidor
client = setup_connection()

# Perguntar o nome do usuário
username = input("Digite seu nome: ")
client.send(username.encode("utf-8"))

# Inicia thread para receber mensagens do servidor
start_receiving(client)

# Sessão de input interativo
session = PromptSession()
print(f"Conectado ao servidor. Digite suas mensagens (ou !sair para sair):")

while True:
    with patch_stdout():  # permite que mensagens recebidas não quebrem seu input
        msg = session.prompt(f"[{username}]: ")

    if msg.lower() == "!sair":
        print(f"*** {username} saiu do chat! ***")
        client.close()
        break

    # Envia a mensagem já formatada com [nome]:
    client.send(f"[{username}]: {msg}".encode("utf-8"))
