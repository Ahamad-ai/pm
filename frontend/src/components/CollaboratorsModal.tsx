"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  addCollaborator,
  disableShareLink,
  enableShareLink,
  getShareLink,
  listCollaborators,
  removeCollaborator,
  type Collaborator,
} from "@/lib/boardApi";

type CollaboratorsModalProps = {
  username: string;
  boardId: number;
  boardName: string;
  ownerUsername?: string | null;
  isOwner: boolean;
  onClose: () => void;
  onChange?: () => void;
};

export function CollaboratorsModal({
  username,
  boardId,
  boardName,
  ownerUsername,
  isOwner,
  onClose,
  onChange,
}: CollaboratorsModalProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftUsername, setDraftUsername] = useState("");
  const [draftRole, setDraftRole] = useState<"viewer" | "editor">("editor");
  const [busy, setBusy] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await listCollaborators(username, boardId);
      setCollaborators(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load collaborators.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const link = await getShareLink(username, boardId);
        if (!cancelled) {
          setShareToken(link.token ?? null);
          setShareUrl(
            link.token
              ? `${window.location.origin}/share?token=${link.token}`
              : null
          );
        }
      } catch {
        // ignore — owner-only info anyway
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [username, boardId]);

  const handleEnableShare = async () => {
    setBusy(true);
    setError(null);
    try {
      const link = await enableShareLink(username, boardId);
      setShareToken(link.token ?? null);
      setShareUrl(
        link.token ? `${window.location.origin}/share?token=${link.token}` : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable link.");
    } finally {
      setBusy(false);
    }
  };

  const handleDisableShare = async () => {
    if (!window.confirm("Revoke the public link? Anyone with the URL will lose access.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await disableShareLink(username, boardId);
      setShareToken(null);
      setShareUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke link.");
    } finally {
      setBusy(false);
    }
  };

  const handleCopyShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  };

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draftUsername.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addCollaborator(username, boardId, draftUsername.trim(), draftRole);
      setDraftUsername("");
      setDraftRole("editor");
      await refresh();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add collaborator.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (target: string) => {
    if (!window.confirm(`Remove ${target} from "${boardName}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      await removeCollaborator(username, boardId, target);
      await refresh();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove collaborator.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      data-testid="collaborators-modal"
      role="dialog"
      aria-label={`Collaborators for ${boardName}`}
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--stroke)] bg-white p-5 shadow-[var(--shadow)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Collaborators
            </p>
            <h2 className="font-display text-xl font-semibold text-[var(--navy-dark)]">
              {boardName}
            </h2>
            {ownerUsername ? (
              <p className="mt-1 text-xs text-[var(--gray-text)]">
                Owner: @{ownerUsername}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--stroke)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-[var(--secondary-purple)]/20 bg-[var(--secondary-purple)]/5 px-3 py-2 text-xs text-[var(--secondary-purple)]"
          >
            {error}
          </p>
        ) : null}

        <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto" data-testid="collaborator-list">
          {isLoading && (
            <li className="text-xs text-[var(--gray-text)]">Loading…</li>
          )}
          {!isLoading && collaborators.length === 0 && (
            <li className="text-xs text-[var(--gray-text)]">
              No collaborators yet.
            </li>
          )}
          {!isLoading &&
            collaborators.map((collab) => (
              <li
                key={collab.username}
                className="flex items-center justify-between gap-2 rounded-xl border border-[var(--stroke)] px-3 py-2"
                data-testid={`collaborator-${collab.username}`}
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--navy-dark)]">
                    {collab.display_name ?? collab.username}
                    <span className="ml-1 text-xs font-normal text-[var(--gray-text)]">
                      @{collab.username}
                    </span>
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--primary-blue)]">
                    {collab.role}
                  </p>
                </div>
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => handleRemove(collab.username)}
                    className="rounded-full border border-[var(--stroke)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)] hover:border-[var(--secondary-purple)] hover:text-[var(--secondary-purple)]"
                    aria-label={`Remove ${collab.username}`}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
        </ul>

        {isOwner ? (
          <div
            className="mt-4 rounded-xl border border-[var(--stroke)] p-3"
            data-testid="share-section"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Public read-only link
            </p>
            {shareToken ? (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={shareUrl ?? ""}
                    className="flex-1 rounded-lg border border-[var(--stroke)] bg-[var(--surface-muted)] px-2 py-1 text-[11px] text-[var(--navy-dark)]"
                    aria-label="Public share URL"
                    data-testid="share-url"
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <button
                    type="button"
                    onClick={handleCopyShare}
                    className="rounded-md border border-[var(--stroke)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--navy-dark)] hover:border-[var(--primary-blue)]"
                  >
                    {shareCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleDisableShare}
                  disabled={busy}
                  className="rounded-full border border-[var(--stroke)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--secondary-purple)] hover:border-[var(--secondary-purple)]"
                  data-testid="share-revoke"
                >
                  Revoke link
                </button>
              </div>
            ) : (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={handleEnableShare}
                  disabled={busy}
                  className="rounded-full bg-[var(--secondary-purple)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white"
                  data-testid="share-enable"
                >
                  Create public link
                </button>
                <p className="mt-1 text-[10px] text-[var(--gray-text)]">
                  Anyone with the URL can view (but not edit) this board.
                </p>
              </div>
            )}
          </div>
        ) : null}

        {isOwner ? (
          <form onSubmit={handleAdd} className="mt-4 space-y-2" data-testid="add-collaborator-form">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Invite by username
            </p>
            <div className="flex items-center gap-2">
              <input
                value={draftUsername}
                onChange={(event) => setDraftUsername(event.target.value)}
                placeholder="username"
                className="flex-1 rounded-xl border border-[var(--stroke)] px-3 py-1.5 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                aria-label="Collaborator username"
                required
              />
              <select
                value={draftRole}
                onChange={(event) =>
                  setDraftRole(event.target.value as "viewer" | "editor")
                }
                className="rounded-xl border border-[var(--stroke)] px-2 py-1.5 text-xs text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                aria-label="Collaborator role"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-[var(--secondary-purple)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-white shadow-[0_4px_10px_rgba(117,57,145,0.25)] disabled:opacity-60"
              >
                Invite
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-4 text-[11px] text-[var(--gray-text)]">
            Only the owner can manage collaborators.
          </p>
        )}
      </div>
    </div>
  );
}
