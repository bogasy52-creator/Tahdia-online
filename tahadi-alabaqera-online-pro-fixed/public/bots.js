// bots.js - نظام إدارة البوتات للعبة Tahdia Online

class SmartBot {
  constructor(id, name, difficulty = 'medium') {
    this.id = id;
    this.name = name;
    this.difficulty = difficulty;
    this.score = 0;
    
    this.config = difficulty === 'pro' ? {
      reactionDelay: 100,
      errorMargin: 0.05,
      predictionStep: 3
    } : {
      reactionDelay: 350,
      errorMargin: 0.25,
      predictionStep: 1
    };

    this.lastActionTime = 0;
  }

  calculateDecision(gameState) {
    const now = Date.now();
    if (now - this.lastActionTime < this.config.reactionDelay) {
      return null;
    }
    this.lastActionTime = now;

    const target = gameState.target || gameState.opponent;
    if (!target) return { type: 'IDLE' };

    if (this.difficulty === 'pro') {
      return {
        type: 'MOVE',
        targetX: target.x + (target.vx || 0) * this.config.predictionStep,
        targetY: target.y + (target.vy || 0) * this.config.predictionStep,
        action: 'ATTACK'
      };
    } else {
      return {
        type: 'MOVE',
        targetX: target.x,
        targetY: target.y,
        action: 'DEFEND'
      };
    }
  }
}

class BotManager {
  constructor() {
    this.activeBots = new Map();
  }

  spawnBot(difficulty = 'medium') {
    const botId = `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const botName = `Bot_${this.activeBots.size + 1}`;
    const bot = new SmartBot(botId, botName, difficulty);
    this.activeBots.set(botId, bot);
    return bot;
  }

  removeBot(botId) {
    return this.activeBots.delete(botId);
  }
}

module.exports = BotManager;
