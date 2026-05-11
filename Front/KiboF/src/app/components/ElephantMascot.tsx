import { motion } from 'motion/react';

interface ElephantMascotProps {
  size?: 'small' | 'medium' | 'large';
  animate?: boolean;
}

export function ElephantMascot({ size = 'medium', animate = true }: ElephantMascotProps) {
  const dimensions = {
    small: 'w-10 h-10',
    medium: 'w-16 h-16',
    large: 'w-24 h-24',
  };

  return (
    <motion.div
      className={`${dimensions[size]} relative scale-110`}
      animate={animate ? {
        y: [0, -8, 0],
      } : {}}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <circle cx="50" cy="55" r="30" fill="#7FB3E8" />

        <motion.ellipse
          cx="35"
          cy="40"
          rx="12"
          ry="18"
          fill="#4A90E2"
          animate={animate ? {
            ry: [18, 20, 18],
          } : {}}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.ellipse
          cx="65"
          cy="40"
          rx="12"
          ry="18"
          fill="#4A90E2"
          animate={animate ? {
            ry: [18, 20, 18],
          } : {}}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.2,
          }}
        />

        <path
          d="M 50 60 Q 50 75 35 70"
          stroke="#4A90E2"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />

        <motion.g
          animate={animate ? {
            scaleY: [1, 0.3, 1],
          } : {}}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
            times: [0, 0.1, 0.2],
          }}
        >
          <circle cx="42" cy="50" r="4" fill="#1a1a1a" />
        </motion.g>
        <motion.g
          animate={animate ? {
            scaleY: [1, 0.3, 1],
          } : {}}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
            times: [0, 0.1, 0.2],
            delay: 0.1,
          }}
        >
          <circle cx="58" cy="50" r="4" fill="#1a1a1a" />
        </motion.g>

        <circle cx="43" cy="49" r="1.5" fill="white" />
        <circle cx="59" cy="49" r="1.5" fill="white" />

        <motion.circle
          cx="30"
          cy="55"
          r="3"
          fill="#B3D7F5"
          animate={animate ? {
            scale: [1, 1.3, 1],
            opacity: [0.4, 1, 0.4],
          } : {}}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.circle
          cx="70"
          cy="60"
          r="2.5"
          fill="#B3D7F5"
          animate={animate ? {
            scale: [1, 1.3, 1],
            opacity: [0.4, 1, 0.4],
          } : {}}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.3,
          }}
        />

        <motion.path
          d="M 25 70 Q 20 68 18 72"
          stroke="#4A90E2"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          animate={animate ? {
            d: [
              "M 25 70 Q 20 68 18 72",
              "M 25 70 Q 20 75 18 73",
              "M 25 70 Q 20 68 18 72",
            ],
          } : {}}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </svg>
    </motion.div>
  );
}
