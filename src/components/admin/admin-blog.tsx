"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteBlogPost, saveBlogPost } from "@/app/actions/admin";
import type { BlogPostAdminRow, BlogPostStatus } from "@/lib/blog";
import {
  BLOG_CONTENT_MAX,
  BLOG_COVER_MAX_BYTES,
  BLOG_EXCERPT_MAX,
  BLOG_TAG_COUNT_MAX,
  BLOG_TITLE_MAX,
  blogPostPath,
  blogReadingMinutes,
  parseBlogTags,
  serializeBlogTags,
  slugifyBlogTitle,
} from "@/lib/blog-slots";
import { formatDateTime } from "@/lib/format";
import { ListFrame, RecordFrame } from "@/components/admin/console";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { ImagePicker } from "@/components/ui/image-picker";
import { IconAlert, IconCheck, IconFileText, IconPencil, IconPlus, IconTrash } from "@/components/ui/icons";

/**
 * Admin panel for the public blog (/blog). One editor form at a time sits
 * above the list; the list is the source of navigation. Saving invalidates
 * the `blog` cache tag server-side, so the public pages are fresh without a
 * deploy.
 *
 * Local rows are patched after save/delete instead of waiting for a reload —
 * `router.refresh()` re-syncs unrelated counters in the background. The
 * `renderedContent` field is server-computed and unused here, so patched rows
 * carry an empty string; nothing in this panel reads it.
 */

type Draft = {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  tags: string;
  content: string;
  coverImage: string | null;
  status: BlogPostStatus;
};

const EMPTY_DRAFT: Draft = {
  id: null,
  title: "",
  slug: "",
  excerpt: "",
  tags: "",
  content: "",
  coverImage: null,
  status: "draft",
};

export function BlogPanel({ initial }: { initial: BlogPostAdminRow[] }) {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPostAdminRow[]>(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const effectiveSlug = draft ? slugifyBlogTitle(draft.slug.trim() || draft.title) : "";
  const slugOk = effectiveSlug.length > 0;
  const canSave =
    draft !== null &&
    draft.title.trim().length > 0 &&
    slugOk &&
    (draft.status !== "published" || draft.content.trim().length > 0) &&
    !pending;

  function openNew() {
    setDraft({ ...EMPTY_DRAFT });
    setError(null);
    setFlash(null);
    setConfirmDelete(null);
  }

  function openEdit(row: BlogPostAdminRow) {
    setDraft({
      id: row.id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      tags: serializeBlogTags(row.tags),
      content: row.content,
      coverImage: row.coverImage,
      status: row.status,
    });
    setError(null);
    setFlash(null);
    setConfirmDelete(null);
  }

  async function apply() {
    if (!draft || !canSave) return;
    setPending(true);
    setError(null);
    const result = await saveBlogPost({
      id: draft.id,
      title: draft.title.trim(),
      slug: draft.slug.trim(),
      excerpt: draft.excerpt.trim(),
      content: draft.content,
      coverImage: draft.coverImage,
      tags: draft.tags,
      status: draft.status,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const now = new Date().toISOString();
    setPosts((prev) => {
      const existing = prev.find((item) => item.id === result.id);
      const next: BlogPostAdminRow = {
        id: result.id,
        slug: result.slug,
        title: draft.title.trim(),
        excerpt: draft.excerpt.trim(),
        content: draft.content,
        coverImage: draft.coverImage,
        tags: parseBlogTags(draft.tags),
        readingMinutes: blogReadingMinutes(draft.content),
        publishedAt: existing?.publishedAt ?? (draft.status === "published" ? now : null),
        updatedAt: now,
        renderedContent: existing?.renderedContent ?? "",
        status: draft.status,
        authorEmail: existing?.authorEmail ?? null,
        createdAt: existing?.createdAt ?? now,
      };
      return existing
        ? prev.map((item) => (item.id === result.id ? next : item))
        : [next, ...prev];
    });
    setFlash(
      draft.id
        ? draft.status === "published"
          ? "Artikel tersimpan dan terbit di /blog."
          : "Artikel tersimpan sebagai draf."
        : draft.status === "published"
          ? "Artikel baru diterbitkan di /blog."
          : "Draf artikel dibuat.",
    );
    setDraft(null);
    router.refresh();
  }

  async function remove(id: string) {
    setPending(true);
    setError(null);
    const result = await deleteBlogPost(id);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPosts((prev) => prev.filter((item) => item.id !== id));
    setConfirmDelete(null);
    setFlash("Artikel dihapus permanen.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <Button size="sm" leadingIcon={<IconPlus size={15} />} onClick={openNew}>
          Tulis artikel baru
        </Button>
        <Badge tone="neutral">
          {posts.filter((post) => post.status === "published").length} terbit ·{" "}
          {posts.filter((post) => post.status === "draft").length} draf
        </Badge>
      </div>

      {flash ? (
        <Notice tone="astra" icon={<IconCheck size={15} />} title="Tersimpan">
          {flash}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" icon={<IconAlert size={15} />} title="Gagal">
          {error}
        </Notice>
      ) : null}

      {draft ? (
        <Editor
          draft={draft}
          pending={pending}
          canSave={canSave}
          effectiveSlug={effectiveSlug}
          slugOk={slugOk}
          onChange={(patch) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
          onCancel={() => setDraft(null)}
          onSave={() => void apply()}
        />
      ) : null}

      {posts.length === 0 && !draft ? (
        <EmptyState
          icon={<IconFileText size={22} />}
          title="Belum ada artikel"
          description="Artikel blog tampil di /blog dan masuk sitemap — mesin pencari bisa menemukan halaman ini untuk kata kunci seperti 'beli robux aman' atau 'cara top up gamepass'."
          action={
            <Button size="sm" leadingIcon={<IconPlus size={15} />} onClick={openNew}>
              Tulis artikel pertama
            </Button>
          }
        />
      ) : (
        <ListFrame>
          {posts.map((post) => (
            <div
              key={post.id}
              className="flex flex-col gap-2.5 px-4 py-3.5 transition-colors duration-200 hover:bg-canvas-2/60 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={post.status === "published" ? "success" : "muted"}>
                    {post.status === "published" ? "Terbit" : "Draf"}
                  </Badge>
                  <span className="truncate text-[13px] font-bold text-ink">{post.title}</span>
                </div>
                <span className="num truncate text-[11px] text-ink-mute">
                  {blogPostPath(post.slug)} · diperbarui {formatDateTime(post.updatedAt)}
                </span>
              </div>

              {confirmDelete === post.id ? (
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[11px] font-bold text-danger">Hapus permanen?</span>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={pending}
                    onClick={() => void remove(post.id)}
                  >
                    Ya, hapus
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => setConfirmDelete(null)}
                  >
                    Batal
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<IconPencil size={14} />}
                    onClick={() => openEdit(post)}
                  >
                    Sunting
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={<IconTrash size={14} />}
                    onClick={() => setConfirmDelete(post.id)}
                  >
                    Hapus
                  </Button>
                </div>
              )}
            </div>
          ))}
        </ListFrame>
      )}
    </div>
  );
}

function Editor({
  draft,
  pending,
  canSave,
  effectiveSlug,
  slugOk,
  onChange,
  onCancel,
  onSave,
}: {
  draft: Draft;
  pending: boolean;
  canSave: boolean;
  effectiveSlug: string;
  slugOk: boolean;
  onChange: (patch: Partial<Draft>) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <RecordFrame>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="eyebrow text-ink-mute">
          {draft.id ? "Sunting artikel" : "Artikel baru"}
        </span>
        <span className="num text-[11px] text-ink-mute">
          {effectiveSlug ? blogPostPath(effectiveSlug) : "/blog/…"}
        </span>
      </div>

      <Field label="Judul" htmlFor="blog-title">
        <TextInput
          id="blog-title"
          value={draft.title}
          maxLength={BLOG_TITLE_MAX}
          placeholder="mis. Cara Aman Beli Robux di 2026"
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Slug URL"
          htmlFor="blog-slug"
          hint="Kosongkan untuk otomatis dari judul. Mengubah slug mematikan URL lama."
          error={!slugOk ? "Isi judul atau slug dengan huruf/angka." : null}
        >
          <TextInput
            id="blog-slug"
            value={draft.slug}
            invalid={!slugOk}
            placeholder="otomatis-dari-judul"
            onChange={(event) => onChange({ slug: event.target.value })}
          />
        </Field>
        <Field
          label="Tag"
          htmlFor="blog-tags"
          hint={`Pisahkan dengan koma, maksimal ${BLOG_TAG_COUNT_MAX} tag.`}
        >
          <TextInput
            id="blog-tags"
            value={draft.tags}
            placeholder="robux, tips, keamanan"
            onChange={(event) => onChange({ tags: event.target.value })}
          />
        </Field>
      </div>

      <Field
        label="Ringkasan"
        htmlFor="blog-excerpt"
        hint="Tampil di kartu /blog dan sebagai description di Google. Kosongkan untuk diambil otomatis dari isi."
      >
        <TextArea
          id="blog-excerpt"
          value={draft.excerpt}
          maxLength={BLOG_EXCERPT_MAX}
          placeholder="Satu-dua kalimat yang membuat orang mau klik."
          onChange={(event) => onChange({ excerpt: event.target.value })}
        />
      </Field>

      <Field
        label="Isi artikel (Markdown)"
        htmlFor="blog-content"
        hint="## Subjudul, **tebal**, *miring*, - daftar, 1. daftar angka, > kutipan, `kode`, [teks](/katalog), dan blok ``` kode."
      >
        <TextArea
          id="blog-content"
          value={draft.content}
          maxLength={BLOG_CONTENT_MAX}
          rows={14}
          placeholder={"## Pendahuluan\n\nTulis paragraf pembuka di sini.\n\n- Poin pertama\n- Poin kedua"}
          onChange={(event) => onChange({ content: event.target.value })}
        />
      </Field>

      <ImagePicker
        value={draft.coverImage}
        onChange={(next) => onChange({ coverImage: next })}
        label="Sampul (opsional)"
        hint={`PNG/JPG/GIF/WebP maksimal ${Math.round(BLOG_COVER_MAX_BYTES / 1000)}KB, atau tempel URL. Rasio enak dilihat: 16:9.`}
        maxBytes={BLOG_COVER_MAX_BYTES}
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          variant={draft.status === "published" ? "secondary" : "primary"}
          size="sm"
          disabled={pending}
          onClick={() => onChange({ status: draft.status === "published" ? "draft" : "published" })}
        >
          {draft.status === "published" ? "Jadikan draf" : "Tandai terbit"}
        </Button>
        <Badge tone={draft.status === "published" ? "success" : "muted"}>
          {draft.status === "published" ? "Akan terbit" : "Draf"}
        </Badge>
        <span className="ml-auto flex flex-wrap gap-2.5">
          <Button
            size="sm"
            leadingIcon={<IconCheck size={15} />}
            disabled={!canSave}
            onClick={onSave}
          >
            {pending ? "Menyimpan..." : "Simpan artikel"}
          </Button>
          <Button variant="ghost" size="sm" disabled={pending} onClick={onCancel}>
            Tutup
          </Button>
        </span>
      </div>
    </RecordFrame>
  );
}
