import { motion } from 'motion/react';

interface KiboLogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export function KiboLogo({ size = 'medium', showText = true }: KiboLogoProps) {
  const dimensions = {
    small: { container: 'h-10', text: 'text-xl' },
    medium: { container: 'h-12', text: 'text-2xl' },
    large: { container: 'h-16', text: 'text-3xl' },
  };

  return (
    <div className="flex items-center gap-3">
      <div className={`${dimensions[size].container} aspect-square relative`}>
        <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <defs>
            <linearGradient id="kiboGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4A90E2" />
              <stop offset="100%" stopColor="#7FB3E8" />
            </linearGradient>
            <filter id="shadow">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.2"/>
            </filter>
          </defs>

          <rect x="10" y="10" width="100" height="100" rx="24" fill="url(#kiboGradient)" filter="url(#shadow)" />

          <motion.g
            animate={{
              y: [0, -2, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <circle cx="60" cy="65" r="22" fill="white" opacity="0.95" />

            <ellipse cx="48" cy="52" rx="8" ry="12" fill="#7FB3E8" />
            <ellipse cx="72" cy="52" rx="8" ry="12" fill="#7FB3E8" />

            <circle cx="54" cy="60" r="3" fill="#1a1a1a" />
            <circle cx="66" cy="60" r="3" fill="#1a1a1a" />

            <circle cx="54.5" cy="59" r="1" fill="white" />
            <circle cx="66.5" cy="59" r="1" fill="white" />

            <path
              d="M 60 65 Q 60 72 50 68"
              stroke="#4A90E2"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />

            <motion.path
              d="M 45 65 Q 40 68 38 65"
              stroke="#7FB3E8"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              animate={{
                d: [
                  "M 45 65 Q 40 68 38 65",
                  "M 45 65 Q 40 70 38 68",
                  "M 45 65 Q 40 68 38 65",
                ],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <motion.path
              d="M 75 65 Q 80 68 82 65"
              stroke="#7FB3E8"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              animate={{
                d: [
                  "M 75 65 Q 80 68 82 65",
                  "M 75 65 Q 80 70 82 68",
                  "M 75 65 Q 80 68 82 65",
                ],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 0.2,
              }}
            />
          </motion.g>

          <motion.text
            x="60"
            y="95"
            textAnchor="middle"
            fill="#1a1a1a"
            fontSize="20"
            fontWeight="700"
            animate={{
              opacity: [0.8, 1, 0.8],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            K
          </motion.text>
        </svg>
      </div>

      {showText && (
        <motion.h1
          className={`${dimensions[size].text} font-bold text-foreground tracking-tight`}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
        >
          Kibo
        </motion.h1>
      )}
    </div>
  );
}
