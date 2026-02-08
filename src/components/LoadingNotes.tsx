import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";

export default function LoadingNotes() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-2xl mx-auto text-center py-16 space-y-6"
    >
      <motion.div
        animate={{ rotate: [0, 10, -10, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        className="inline-flex rounded-full bg-primary/10 p-5"
      >
        <BookOpen className="h-10 w-10 text-primary" />
      </motion.div>
      <div>
        <h2 className="text-2xl font-heading text-foreground">Generating your notes...</h2>
        <p className="text-muted-foreground mt-2 font-body">
          Analyzing the syllabus and creating structured study material
        </p>
      </div>
      <div className="space-y-3 max-w-md mx-auto">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-4 rounded-full bg-muted overflow-hidden"
            style={{ width: `${100 - i * 15}%`, marginLeft: "auto", marginRight: "auto" }}
          >
            <div
              className="h-full bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 animate-shimmer"
              style={{ backgroundSize: "200% 100%" }}
            />
          </div>
        ))}
      </div>
    </motion.div>
  );
}
