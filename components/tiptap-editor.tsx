'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Bold, Italic, List, ListOrdered, Quote, Redo, Strikethrough, Undo, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import { useEffect } from 'react';

interface TiptapEditorProps {
    content: string;
    onChange: (content: string) => void;
    editable?: boolean;
}

const MenuBar = ({ editor }: { editor: Editor | null }) => {
    if (!editor) {
        return null;
    }

    const addImage = () => {
        const url = window.prompt('URL de la imagen:');
        if (url) {
            editor.chain().focus().setImage({ src: url }).run();
        }
    };

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('URL del enlace:', previousUrl);

        // cancelled
        if (url === null) {
            return;
        }

        // empty
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        // update
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };

    return (
        <div className="flex flex-wrap gap-2 p-2 mb-2 border-b border-border bg-muted/20 rounded-t-lg">
            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                className={`p-2 rounded hover:bg-background transition-colors ${editor.isActive('bold') ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}
            >
                <Bold size={18} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                className={`p-2 rounded hover:bg-background transition-colors ${editor.isActive('italic') ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}
            >
                <Italic size={18} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                disabled={!editor.can().chain().focus().toggleStrike().run()}
                className={`p-2 rounded hover:bg-background transition-colors ${editor.isActive('strike') ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}
            >
                <Strikethrough size={18} />
            </button>
            <div className="w-px h-8 bg-border mx-1" />
            <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-2 rounded hover:bg-background transition-colors ${editor.isActive('bulletList') ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}
            >
                <List size={18} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-2 rounded hover:bg-background transition-colors ${editor.isActive('orderedList') ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}
            >
                <ListOrdered size={18} />
            </button>
            <div className="w-px h-8 bg-border mx-1" />
            <button
                onClick={setLink}
                className={`p-2 rounded hover:bg-background transition-colors ${editor.isActive('link') ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}
            >
                <LinkIcon size={18} />
            </button>
            <button
                onClick={addImage}
                className="p-2 rounded hover:bg-background transition-colors text-muted-foreground"
            >
                <ImageIcon size={18} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`p-2 rounded hover:bg-background transition-colors ${editor.isActive('blockquote') ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}
            >
                <Quote size={18} />
            </button>
            <div className="w-px h-8 bg-border mx-1" />
            <button
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().chain().focus().undo().run()}
                className="p-2 rounded hover:bg-background transition-colors text-muted-foreground disabled:opacity-50"
            >
                <Undo size={18} />
            </button>
            <button
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().chain().focus().redo().run()}
                className="p-2 rounded hover:bg-background transition-colors text-muted-foreground disabled:opacity-50"
            >
                <Redo size={18} />
            </button>
        </div>
    );
};

export const TiptapEditor = ({ content, onChange, editable = true }: TiptapEditorProps) => {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Link.configure({
                openOnClick: false,
            }),
            Image,
        ],
        content,
        immediatelyRender: false,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editable,
        editorProps: {
            attributes: {
                className: 'tiptap-content text-foreground w-full max-w-none p-4',
            },
        },
    });

    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            // Only update via prop if it's significantly different to avoid cursor jumping
            // or if it's empty (reset)
            if (content === '') {
                editor.commands.setContent(content);
            }
        }
    }, [content, editor]);

    return (
        <div className="border border-border rounded-lg bg-card-bg overflow-hidden transition-all h-[600px] flex flex-col">
            {editable && <MenuBar editor={editor} />}
            <EditorContent
                editor={editor}
                className="flex-1 overflow-y-auto [&_.ProseMirror]:min-h-full [&_.ProseMirror]:outline-none [&_.ProseMirror]:p-4"
            />
        </div>
    );
};
