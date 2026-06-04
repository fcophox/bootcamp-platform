'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Code } from 'lucide-react';
import { useEffect } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none w-full px-4 py-3 min-h-[150px] bg-background focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Update content if value changes from outside
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  const toggleLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    if (previousUrl) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt('URL:');
    if (url === null) {
      return;
    }
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="w-full rounded-md border border-border overflow-hidden bg-background focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-card-bg p-1.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded transition-colors ${editor.isActive('bold') ? 'bg-primary/20 text-primary' : 'text-muted hover:text-foreground hover:bg-hover-bg'}`}
          title="Bold"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded transition-colors ${editor.isActive('italic') ? 'bg-primary/20 text-primary' : 'text-muted hover:text-foreground hover:bg-hover-bg'}`}
          title="Italic"
        >
          <Italic size={16} />
        </button>
        <div className="w-px h-4 bg-border mx-1"></div>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded transition-colors ${editor.isActive('bulletList') ? 'bg-primary/20 text-primary' : 'text-muted hover:text-foreground hover:bg-hover-bg'}`}
          title="Bullet List"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded transition-colors ${editor.isActive('orderedList') ? 'bg-primary/20 text-primary' : 'text-muted hover:text-foreground hover:bg-hover-bg'}`}
          title="Numbered List"
        >
          <ListOrdered size={16} />
        </button>
        <div className="w-px h-4 bg-border mx-1"></div>
        <button
          type="button"
          onClick={toggleLink}
          className={`p-1.5 rounded transition-colors ${editor.isActive('link') ? 'bg-primary/20 text-primary' : 'text-muted hover:text-foreground hover:bg-hover-bg'}`}
          title="Link"
        >
          <LinkIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-1.5 rounded transition-colors ${editor.isActive('codeBlock') ? 'bg-primary/20 text-primary' : 'text-muted hover:text-foreground hover:bg-hover-bg'}`}
          title="Code Block"
        >
          <Code size={16} />
        </button>
      </div>
      
      <EditorContent editor={editor} />
    </div>
  );
}
