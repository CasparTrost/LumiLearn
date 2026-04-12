import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const BASE = (import.meta.env.BASE_URL || '/LumiLearn/') + 'sprites/farm/';
const sp = (f) => BASE + f;

// Web Audio sound generators
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const g = ctx.createGain();
    g.connect(ctx.destination);
    if (type === 'cow') {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(120, ctx.currentTime);
      o.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.4);
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      o.connect(g); o.start(); o.stop(ctx.currentTime + 0.5);
    } else if (type === 'sheep') {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(400, ctx.currentTime);
      o.frequency.linearRampToValueAtTime(300, ctx.currentTime + 0.1);
      o.frequency.linearRampToValueAtTime(380, ctx.currentTime + 0.3);
      g.gain.setValueAtTime(0.25, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      o.connect(g); o.start(); o.stop(ctx.currentTime + 0.4);
    } else if (type === 'chicken') {
      [0, 0.08, 0.16].forEach((t) => {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.setValueAtTime(800, ctx.currentTime + t);
        o.frequency.linearRampToValueAtTime(600, ctx.currentTime + t + 0.06);
        const gg = ctx.createGain();
        gg.gain.setValueAtTime(0.15, ctx.currentTime + t);
        gg.gain.linearRampToValueAtTime(0, ctx.currentTime + t + 0.07);
        o.connect(gg); gg.connect(ctx.destination);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.07);
      });
    } else if (type === 'pig') {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(250, ctx.currentTime);
      o.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.15);
      o.frequency.linearRampToValueAtTime(260, ctx.currentTime + 0.3);
      g.gain.setValueAtTime(0.25, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
      o.connect(g); o.start(); o.stop(ctx.currentTime + 0.35);
    } else if (type === 'chime') {
      [523, 659, 784].forEach((freq, i) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq;
        const gg = ctx.createGain();
        gg.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.1);
        gg.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.1 + 0.4);
        o.connect(gg); gg.connect(ctx.destination);
        o.start(ctx.currentTime + i * 0.1);
        o.stop(ctx.currentTime + i * 0.1 + 0.5);
      });
    }
  } catch (e) { /* audio not available */ }
}

// Sparkle component
function Sparkle({ x, y, onDone }) {
  return (
    <motion.div
      style={{ position: 'absolute', left: x - 20, top: y - 20, width: 40, height: 40,
        pointerEvents: 'none', zIndex: 100, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 20 }}
      initial={{ opacity: 1, scale: 0.5 }}
      animate={{ opacity: 0, scale: 2, y: -30 }}
      transition={{ duration: 0.6 }}
      onAnimationComplete={onDone}
    >
      *
    </motion.div>
  );
}

// Player canvas walk animation
function PlayerCanvas({ visible }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const frameRef = useRef(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    const img = new window.Image();
    img.src = sp('f_player.png');
    imgRef.current = img;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx2 = canvas.getContext('2d');
      const COLS = 4;
      const FRAME_W = 48;
      const FRAME_H = 48;
      intervalRef.current = setInterval(() => {
        frameRef.current = (frameRef.current + 1) % COLS;
        ctx2.clearRect(0, 0, 96, 96);
        ctx2.drawImage(
          img,
          frameRef.current * FRAME_W, 0,
          FRAME_W, FRAME_H,
          0, 0, 96, 96
        );
      }, 180);
    };
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [visible]);

  if (!visible) return null;
  return (
    <canvas
      ref={canvasRef}
      width={96}
      height={96}
      style={{ position: 'absolute', left: 215, bottom: 82, zIndex: 20,
        imageRendering: 'pixelated', cursor: 'pointer' }}
      onClick={() => playSound('chime')}
    />
  );
}

// Cloud component
function Cloud({ style, duration, delay }) {
  return (
    <motion.div
      style={{
        position: 'absolute',
        width: 80, height: 30,
        background: 'rgba(255,255,255,0.85)',
        borderRadius: 30,
        boxShadow: '0 2px 8px rgba(255,255,255,0.5)',
        ...style,
      }}
      animate={{ x: ['-120px', '700px'] }}
      transition={{ duration, delay, repeat: Infinity, ease: 'linear' }}
    />
  );
}

export default function FarmProgress({ completedCount: _cc }) {
  const completedCount = 17; // hardcoded for preview - shows max level
  const [sparkles, setSparkles] = useState([]);
  const [bouncing, setBouncing] = useState({});

  const level = completedCount >= 17 ? 6
    : completedCount >= 13 ? 5
    : completedCount >= 9 ? 4
    : completedCount >= 6 ? 3
    : completedCount >= 3 ? 2
    : 1;

  const maxModules = 18;
  const expPct = Math.min(100, Math.round((completedCount / maxModules) * 100));

  const show = useCallback((threshold) => completedCount >= threshold, [completedCount]);

  const handleAnimal = useCallback((e, soundType, key) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const parentRect = e.currentTarget.closest('.farm-scene').getBoundingClientRect();
    const x = rect.left - parentRect.left + rect.width / 2;
    const y = rect.top - parentRect.top;
    const id = Date.now() + Math.random();
    setSparkles((s) => [...s, { id, x, y }]);
    setBouncing((b) => ({ ...b, [key]: true }));
    setTimeout(() => setBouncing((b) => ({ ...b, [key]: false })), 700);
    playSound(soundType);
  }, []);

  const removeSparkle = useCallback((id) => {
    setSparkles((s) => s.filter((sp2) => sp2.id !== id));
  }, []);

  const animalVariants = {
    idle: (delay) => ({
      y: [0, -5, 0],
      transition: { duration: 2, repeat: Infinity, ease: 'easeInOut', delay }
    }),
    bounce: {
      y: [0, -28, 0],
      transition: { duration: 0.6, ease: 'easeOut' }
    }
  };

  const treeVariants = {
    sway: (delay) => ({
      rotate: [-1, 1, -1],
      transition: { duration: 3, repeat: Infinity, ease: 'easeInOut', delay }
    })
  };

  return (
    <div style={{ width: '100%', maxWidth: 640, margin: '0 auto', fontFamily: 'sans-serif' }}>
      {/* Scene */}
      <div
        className="farm-scene"
        style={{
          position: 'relative',
          width: 640,
          height: 300,
          overflow: 'hidden',
          borderRadius: 0,
          background: 'linear-gradient(180deg, #1a6db5 0%, #2980d4 40%, #87ceeb 100%)',
          userSelect: 'none',
        }}
      >
        {/* Animated sky overlay */}
        <motion.div
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(20,60,120,0.4) 0%, transparent 60%)',
            zIndex: 0,
          }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Sun */}
        <motion.div
          style={{
            position: 'absolute', top: 14, right: 40, width: 44, height: 44,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #ffe066 40%, #ffb300 100%)',
            boxShadow: '0 0 24px 8px rgba(255,200,0,0.5)',
            zIndex: 2,
          }}
          animate={{ boxShadow: [
            '0 0 24px 8px rgba(255,200,0,0.4)',
            '0 0 40px 16px rgba(255,200,0,0.7)',
            '0 0 24px 8px rgba(255,200,0,0.4)',
          ]}}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Clouds */}
        <Cloud style={{ top: 22, left: -120 }} duration={28} delay={0} />
        <Cloud style={{ top: 50, left: -200, width: 60, height: 22, opacity: 0.7 }} duration={38} delay={5} />
        <Cloud style={{ top: 10, left: -300, width: 100, height: 36 }} duration={50} delay={15} />

        {/* Ground - grass tiles */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 90,
          backgroundImage: `url(${sp('f_grass.png')})`,
          backgroundSize: '64px 64px',
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'bottom',
          zIndex: 3,
        }} />

        {/* Farmland patch center */}
        <div style={{
          position: 'absolute', bottom: 72, left: 240, width: 140, height: 40,
          backgroundImage: `url(${sp('f_farmland.png')})`,
          backgroundSize: '32px 32px',
          backgroundRepeat: 'repeat',
          zIndex: 4,
          opacity: 0.9,
          borderRadius: 4,
        }} />

        {/* Water area bottom-right */}
        {show(13) && (
          <div style={{
            position: 'absolute', bottom: 72, right: 8, width: 120, height: 50,
            backgroundImage: `url(${sp('f_water.png')})`,
            backgroundSize: '32px 32px',
            backgroundRepeat: 'repeat',
            zIndex: 4,
            borderRadius: 6,
            overflow: 'hidden',
          }}>
            <motion.div
              style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0) 100%)',
              }}
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
            />
            <motion.span
              style={{ position: 'absolute', bottom: 4, left: 8, fontSize: 18 }}
              animate={{ x: [0, 20, 0], y: [0, -2, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              ~
            </motion.span>
          </div>
        )}

        {/* House */}
        <motion.img
          src={sp('f_house.png')}
          alt="house"
          style={{
            position: 'absolute', bottom: 80, left: 10,
            width: 120, height: 160, zIndex: 10,
            imageRendering: 'pixelated', cursor: 'pointer',
          }}
          whileHover={{ scale: 1.04 }}
          onClick={() => playSound('chime')}
        />

        {/* Tree 1 near house */}
        <motion.img
          src={sp('f_tree.png')}
          alt="tree"
          style={{
            position: 'absolute', bottom: 82, left: 140,
            width: 72, height: 90, zIndex: 9,
            imageRendering: 'pixelated', transformOrigin: 'bottom center',
          }}
          variants={treeVariants}
          animate={treeVariants.sway(0)}
        />

        {/* Tree 2 right side */}
        {show(9) && (
          <motion.img
            src={sp('f_tree.png')}
            alt="tree"
            style={{
              position: 'absolute', bottom: 80, right: 30,
              width: 68, height: 85, zIndex: 9,
              imageRendering: 'pixelated', transformOrigin: 'bottom center',
            }}
            variants={treeVariants}
            animate={treeVariants.sway(1.2)}
          />
        )}

        {/* Fence */}
        {show(3) && (
          <motion.img
            src={sp('f_fence.png')}
            alt="fence"
            style={{
              position: 'absolute', bottom: 78, left: 200,
              height: 36, zIndex: 11,
              imageRendering: 'pixelated',
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          />
        )}

        {/* Player */}
        <PlayerCanvas visible={show(3)} />

        {/* Chicken */}
        {show(3) && (
          <motion.img
            src={sp('f_chicken.png')}
            alt="chicken"
            style={{
              position: 'absolute', bottom: 76, left: 280,
              width: 56, height: 56, zIndex: 15,
              imageRendering: 'pixelated', cursor: 'pointer',
            }}
            animate={bouncing['chicken'] ? { y: [0, -28, 0] } : { y: [0, -5, 0] }}
            transition={bouncing['chicken']
              ? { duration: 0.6, ease: 'easeOut' }
              : { duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }
            }
            onClick={(e) => handleAnimal(e, 'chicken', 'chicken')}
          />
        )}

        {/* Sheep */}
        {show(6) && (
          <motion.img
            src={sp('f_sheep.png')}
            alt="sheep"
            style={{
              position: 'absolute', bottom: 76, left: 340,
              width: 62, height: 62, zIndex: 15,
              imageRendering: 'pixelated', cursor: 'pointer',
            }}
            animate={bouncing['sheep'] ? { y: [0, -28, 0] } : { y: [0, -5, 0] }}
            transition={bouncing['sheep']
              ? { duration: 0.6, ease: 'easeOut' }
              : { duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.7 }
            }
            onClick={(e) => handleAnimal(e, 'sheep', 'sheep')}
          />
        )}

        {/* Cow */}
        {show(9) && (
          <motion.img
            src={sp('f_cow.png')}
            alt="cow"
            style={{
              position: 'absolute', bottom: 76, left: 400,
              width: 68, height: 68, zIndex: 15,
              imageRendering: 'pixelated', cursor: 'pointer',
            }}
            animate={bouncing['cow'] ? { y: [0, -28, 0] } : { y: [0, -5, 0] }}
            transition={bouncing['cow']
              ? { duration: 0.6, ease: 'easeOut' }
              : { duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }
            }
            onClick={(e) => handleAnimal(e, 'cow', 'cow')}
          />
        )}

        {/* Pig */}
        {show(6) && (
          <motion.img
            src={sp('f_pig.png')}
            alt="pig"
            style={{
              position: 'absolute', bottom: 76, left: 470,
              width: 60, height: 60, zIndex: 15,
              imageRendering: 'pixelated', cursor: 'pointer',
            }}
            animate={bouncing['pig'] ? { y: [0, -28, 0] } : { y: [0, -5, 0] }}
            transition={bouncing['pig']
              ? { duration: 0.6, ease: 'easeOut' }
              : { duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }
            }
            onClick={(e) => handleAnimal(e, 'pig', 'pig')}
          />
        )}

        {/* Second Cow */}
        {show(13) && (
          <motion.img
            src={sp('f_cow.png')}
            alt="cow2"
            style={{
              position: 'absolute', bottom: 76, left: 530,
              width: 66, height: 66, zIndex: 15,
              imageRendering: 'pixelated', cursor: 'pointer',
              transform: 'scaleX(-1)',
            }}
            animate={bouncing['cow2'] ? { y: [0, -28, 0] } : { y: [0, -5, 0] }}
            transition={bouncing['cow2']
              ? { duration: 0.6, ease: 'easeOut' }
              : { duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }
            }
            onClick={(e) => handleAnimal(e, 'cow', 'cow2')}
          />
        )}

        {/* Sparkles */}
        <AnimatePresence>
          {sparkles.map((sp2) => (
            <Sparkle key={sp2.id} x={sp2.x} y={sp2.y} onDone={() => removeSparkle(sp2.id)} />
          ))}
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div style={{
        background: '#1a4a1a',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
      }}>
        <span style={{ color: '#7fff7f', fontWeight: 'bold', fontSize: 13, whiteSpace: 'nowrap' }}>
          Level {level} / 6
        </span>
        <div style={{
          flex: 1, height: 14,
          background: 'rgba(0,0,0,0.35)',
          borderRadius: 7,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.15)',
        }}>
          <motion.div
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #3ddc34 0%, #a3ff6e 50%, #3ddc34 100%)',
              backgroundSize: '200% 100%',
              borderRadius: 7,
            }}
            initial={{ width: 0 }}
            animate={{
              width: `${expPct}%`,
              backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'],
            }}
            transition={{
              width: { duration: 1, ease: 'easeOut' },
              backgroundPosition: { duration: 2, repeat: Infinity, ease: 'linear' },
            }}
          />
        </div>
        <span style={{ color: '#aaffaa', fontSize: 12, whiteSpace: 'nowrap' }}>
          {completedCount} / {maxModules} modules
        </span>
      </div>
    </div>
  );
}
