"use client";

import Link from "next/link";
import { ModeToggle } from "@/components/theme-toggler";
import { motion } from "framer-motion";

export function Navbar() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full sticky top-0 z-20 bg-background/30 backdrop-blur-[2px] border-b border-white/[0.02]"
    >
      <div className="container mx-auto max-w-7xl flex justify-between items-center px-4">
        <Link href="/">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="relative"
          >
            <span className="text-xl font-bold text-foreground/90">iThink</span>
          </motion.div>
        </Link>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <ModeToggle />
        </motion.div>
      </div>
    </motion.header>
  );
}
