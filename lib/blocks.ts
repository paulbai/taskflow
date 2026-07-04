/** Convert block-editor JSON content into readable plain text for prompts. */
export function blocksToPlainText(content: string | null): string {
    if (!content) return '';
    try {
        const blocks = JSON.parse(content) as { type: string; content?: string; props?: { checked?: boolean } }[];
        return blocks
            .map(block => {
                const text = (block.content || '')
                    .replace(/<[^>]+>/g, '') // strip inline HTML tags
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .trim();
                if (!text && block.type !== 'divider') return '';
                switch (block.type) {
                    case 'heading1': return `# ${text}`;
                    case 'heading2': return `## ${text}`;
                    case 'heading3': return `### ${text}`;
                    case 'bulletList': return `- ${text}`;
                    case 'numberedList': return `1. ${text}`;
                    case 'todo': return `- [${block.props?.checked ? 'x' : ' '}] ${text}`;
                    case 'quote': return `> ${text}`;
                    case 'code': return `\`\`\`\n${text}\n\`\`\``;
                    case 'divider': return '---';
                    default: return text;
                }
            })
            .filter(Boolean)
            .join('\n');
    } catch {
        return '';
    }
}
