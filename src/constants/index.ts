import { LanguageOption } from '../types';

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { key: 'javascript', label: 'JavaScript', syntaxLang: 'javascript' },
  { key: 'typescript', label: 'TypeScript', syntaxLang: 'typescript' },
  { key: 'jsx', label: 'JSX', syntaxLang: 'jsx' },
  { key: 'tsx', label: 'TSX', syntaxLang: 'tsx' },
  { key: 'styled-components', label: 'Styled Components', syntaxLang: 'css' },
  { key: 'mixins', label: 'SCSS Mixins', syntaxLang: 'scss' },
  { key: 'css-variables', label: 'CSS Variables', syntaxLang: 'css' },
  { key: 'theme', label: 'Theme Config', syntaxLang: 'typescript' },
  { key: 'json', label: 'JSON', syntaxLang: 'json' },
  { key: 'bash', label: 'Bash / Shell', syntaxLang: 'bash' },
];

export const DEFAULT_CODE = `import React, { useState, useEffect } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
}

const UserCard: React.FC<{ userId: number }> = ({ userId }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(\`/api/users/\${userId}\`);
        const data: User = await res.json();
        setUser(data);
      } catch (err) {
        console.error('Failed to fetch user:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  if (loading) return <div className="skeleton" />;
  if (!user) return <div className="error">User not found</div>;

  return (
    <div className="user-card">
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
};

export default UserCard;`;

export const FONT_SIZE_MIN = 11;
export const FONT_SIZE_MAX = 20;
export const FONT_SIZE_DEFAULT = 14;

export const PADDING_MIN = 16;
export const PADDING_MAX = 64;
export const PADDING_DEFAULT = 32;

export const CARD_WIDTH_MIN = 400;
export const CARD_WIDTH_MAX = 960;
export const CARD_WIDTH_DEFAULT = 720;
