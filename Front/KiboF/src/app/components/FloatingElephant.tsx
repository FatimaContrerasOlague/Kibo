import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { MessageCircle } from 'lucide-react';
import { ElephantMascot } from './ElephantMascot';

export function FloatingElephant() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate('/chatbot')}
      className="fixed bottom-5 right-5 z-50 group"
      title="Hablar con Kibo"
      aria-label="Abrir chat con Kibo"
    >
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="relative"
      >
        <div className="rounded-full bg-card/90 border border-border shadow-xl p-2 backdrop-blur-sm">
          <ElephantMascot size="medium" />
        </div>
        <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center shadow-md">
          <MessageCircle className="w-4 h-4" />
        </div>
      </motion.div>
    </button>
  );
}
