import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface AudioVisualizerProps {
    isRecording: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
    isRecording,
}) => {
    const bars = 30;

    return (
        <div className="flex items-center justify-center gap-1 h-16">
            {Array.from({ length: bars }).map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ height: "20%" }}
                    animate={
                        isRecording
                            ? {
                                  height: ["20%", "100%", "20%"],
                                  transition: {
                                      duration: 1,
                                      repeat: Infinity,
                                      delay: i * 0.05,
                                      ease: "easeInOut",
                                  },
                              }
                            : { height: "20%" }
                    }
                    className="w-1 bg-[#B6EA01] rounded-full"
                />
            ))}
        </div>
    );
};
