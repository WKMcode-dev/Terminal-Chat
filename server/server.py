# server.py - Servidor para o chat em Python
import socket
import threading

# Lista de clientes conectados
clients = []
usernames = {}

# Função para repassar mensagens
def broadcast(message, sender=None):
    for client in clients.copy():  # copia evita problemas se remover clientes
        if client != sender:
            try:
                client.send(message.encode('utf-8'))
            except:
                # remove cliente que desconectou
                clients.remove(client)
                usernames.pop(client, None)

# Função para lidar com cada cliente
def handle_client(client):
    while True:
        try:
            message = client.recv(1024).decode('utf-8')
            if not message:
                break

            # Se o cliente ainda não tem username, é a primeira mensagem
            if client not in usernames:
                usernames[client] = message  # armazena o nome de usuário
                broadcast(f"*** {message} entrou no chat! ***")
                print(f"{message} entrou no chat!")
            else:
                broadcast(message, client)
                # print(message)

        except:
            break

    # Cliente desconectou
    username_left = usernames.pop(client, None)  # remove com segurança
    if username_left:
        broadcast(f"*** {username_left} saiu do chat! ***")
        print(f"{username_left} saiu do chat")

    if client in clients:
        clients.remove(client)
    client.close()

# Configuração do servidor
HOST = '0.0.0.0'  # escuta todas interfaces
PORT = 5000

server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.bind((HOST, PORT))
server.listen()
print(f"Servidor Terminal-Chat iniciado em {HOST}:{PORT}")

while True:
    client, addr = server.accept()
    clients.append(client)
    print(f"Cliente conectado: {addr}")
    thread = threading.Thread(target=handle_client, args=(client,))
    thread.start()
