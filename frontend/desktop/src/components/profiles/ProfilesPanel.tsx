import { useState } from "react";
import {
  AtSign,
  Ban,
  CalendarDays,
  Check,
  MessageCircle,
  Pencil,
  Phone,
  UserMinus,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";

import type { Friendship, PublicUser } from "@terminal-chat/protocol";

import type { RealtimeClient } from "../../services/realtime";
import { ProfileEditor, type ProfileEditorValue } from "./ProfileEditor";

interface ProfilesPanelProps {
  profiles: PublicUser[];
  friendships: Friendship[];
  currentUser?: PublicUser;
  realtime: RealtimeClient;
  onMessage: (userId: string) => void;
  onCall: (userId: string) => void;
}

type Relationship =
  | { type: "self" }
  | { type: "none" }
  | { type: "outgoing"; friendship: Friendship }
  | { type: "incoming"; friendship: Friendship }
  | { type: "friends"; friendship: Friendship }
  | { type: "blocked"; friendship: Friendship }
  | { type: "blocked-by"; friendship: Friendship };

export function ProfilesPanel({
  profiles,
  friendships,
  currentUser,
  realtime,
  onMessage,
  onCall,
}: ProfilesPanelProps) {
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string>();

  function send(event: Parameters<RealtimeClient["send"]>[0], message: string) {
    if (realtime.send(event)) setNotice(message);
    else setNotice("A conexão em tempo real ainda não está pronta");
  }

  function saveProfile(value: ProfileEditorValue) {
    const updated = realtime.send({
      type: "profile.update",
      payload: {
        displayName: value.displayName,
        bio: value.bio,
        avatar: value.avatar,
        activity: value.activity,
      },
    });
    const presence = realtime.send({
      type: "presence.update",
      payload: { presence: value.presence, activity: value.activity },
    });
    if (updated && presence) {
      setEditing(false);
      setNotice("Perfil atualizado com sucesso");
    } else {
      setNotice("Não foi possível enviar as alterações do perfil");
    }
  }

  return (
    <section className="content-panel profiles-panel">
      <header className="section-heading">
        <p className="eyebrow">Comunidade</p>
        <h1>Perfis e amizades</h1>
        <p>Edite seu perfil, encontre amigos e inicie conversas ou chamadas.</p>
      </header>
      {notice && <p className="profiles-notice">{notice}</p>}
      <div className="profile-grid">
        {profiles.map((profile) => {
          const relation = relationship(
            friendships,
            currentUser?.id,
            profile.id,
          );
          return (
            <article className="profile-card" key={profile.id}>
              <div className="avatar">
                {profile.avatar ? (
                  <span className="avatar-symbol">{profile.avatar}</span>
                ) : (
                  <UserRound size={25} />
                )}
                <span className={`presence ${profile.presence}`} />
              </div>
              <div>
                <h2>
                  {profile.displayName}
                  {relation.type === "self" && <small>você</small>}
                </h2>
                <p>
                  <AtSign size={14} />
                  {profile.username}
                </p>
              </div>
              <span className={`status-label ${profile.presence}`}>
                {presenceLabel(profile.presence)}
              </span>
              <p className="profile-activity">
                {profile.bio ||
                  profile.activity ||
                  "Nenhuma descrição definida"}
              </p>
              <div className="profile-relationship">
                <span>{relationshipLabel(relation)}</span>
                <ProfileActions
                  onAction={(action) => {
                    switch (action) {
                      case "edit":
                        setEditing(true);
                        break;
                      case "request":
                        send(
                          {
                            type: "friend.request",
                            payload: { userId: profile.id },
                          },
                          "Solicitação de amizade enviada",
                        );
                        break;
                      case "accept":
                      case "decline":
                        if (relation.type !== "incoming") break;
                        send(
                          {
                            type: "friend.respond",
                            payload: {
                              friendshipId: relation.friendship.id,
                              action,
                            },
                          },
                          action === "accept"
                            ? "Solicitação aceita"
                            : "Solicitação recusada",
                        );
                        break;
                      case "remove":
                      case "unblock":
                        send(
                          {
                            type: "friend.remove",
                            payload: { userId: profile.id },
                          },
                          action === "unblock"
                            ? "Usuário desbloqueado"
                            : "Amizade ou solicitação removida",
                        );
                        break;
                      case "block":
                        send(
                          {
                            type: "friend.block",
                            payload: { userId: profile.id },
                          },
                          "Usuário bloqueado",
                        );
                        break;
                      case "message":
                        onMessage(profile.id);
                        break;
                      case "call":
                        onCall(profile.id);
                        break;
                    }
                  }}
                  relationship={relation}
                />
              </div>
              <footer>
                <CalendarDays size={14} /> Desde {formatDate(profile.createdAt)}
              </footer>
            </article>
          );
        })}
      </div>
      {editing && currentUser && (
        <ProfileEditor
          onClose={() => setEditing(false)}
          onSave={saveProfile}
          profile={currentUser}
        />
      )}
    </section>
  );
}

type ProfileAction =
  | "edit"
  | "request"
  | "accept"
  | "decline"
  | "remove"
  | "block"
  | "unblock"
  | "message"
  | "call";

function ProfileActions({
  relationship,
  onAction,
}: {
  relationship: Relationship;
  onAction: (action: ProfileAction) => void;
}) {
  if (relationship.type === "self") {
    return (
      <Action
        icon={<Pencil size={14} />}
        label="Editar"
        onClick={() => onAction("edit")}
      />
    );
  }
  if (relationship.type === "blocked-by") return null;
  if (relationship.type === "blocked") {
    return (
      <Action
        icon={<UserPlus size={14} />}
        label="Desbloquear"
        onClick={() => onAction("unblock")}
      />
    );
  }
  return (
    <div className="profile-actions">
      {relationship.type === "none" && (
        <Action
          icon={<UserPlus size={14} />}
          label="Adicionar"
          onClick={() => onAction("request")}
        />
      )}
      {relationship.type === "incoming" && (
        <>
          <Action
            icon={<Check size={14} />}
            label="Aceitar"
            onClick={() => onAction("accept")}
          />
          <Action
            icon={<X size={14} />}
            label="Recusar"
            onClick={() => onAction("decline")}
          />
        </>
      )}
      {(relationship.type === "friends" ||
        relationship.type === "outgoing") && (
        <Action
          icon={<UserMinus size={14} />}
          label={relationship.type === "friends" ? "Remover" : "Cancelar"}
          onClick={() => onAction("remove")}
        />
      )}
      <Action
        icon={<MessageCircle size={14} />}
        label="Mensagem"
        onClick={() => onAction("message")}
      />
      <Action
        icon={<Phone size={14} />}
        label="Chamar"
        onClick={() => onAction("call")}
      />
      <Action
        danger
        icon={<Ban size={14} />}
        label="Bloquear"
        onClick={() => onAction("block")}
      />
    </div>
  );
}

function Action({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      className={danger ? "profile-action danger" : "profile-action"}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function relationship(
  friendships: Friendship[],
  currentUserId: string | undefined,
  profileId: string,
): Relationship {
  if (!currentUserId || currentUserId === profileId) return { type: "self" };
  const friendship = friendships.find(
    (candidate) =>
      (candidate.requesterId === currentUserId &&
        candidate.addresseeId === profileId) ||
      (candidate.requesterId === profileId &&
        candidate.addresseeId === currentUserId),
  );
  if (!friendship) return { type: "none" };
  if (friendship.status === "accepted") return { type: "friends", friendship };
  if (friendship.status === "blocked")
    return friendship.requesterId === currentUserId
      ? { type: "blocked", friendship }
      : { type: "blocked-by", friendship };
  return friendship.requesterId === currentUserId
    ? { type: "outgoing", friendship }
    : { type: "incoming", friendship };
}

function relationshipLabel(relationship: Relationship): string {
  return {
    self: "Sua conta",
    none: "Ainda não são amigos",
    outgoing: "Solicitação enviada",
    incoming: "Solicitação recebida",
    friends: "Amigos",
    blocked: "Bloqueado por você",
    "blocked-by": "Contato indisponível",
  }[relationship.type];
}

function presenceLabel(presence: PublicUser["presence"]): string {
  return {
    online: "Online",
    away: "Ausente",
    busy: "Ocupado",
    offline: "Offline",
  }[presence];
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
