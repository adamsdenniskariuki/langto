import { describe, expect, it } from 'vitest';
import { leaveMessage } from '../src/views/Lesson.jsx';

describe('leave lesson message', () => {
  it('says the XP earned is kept and the lesson restarts', () => {
    expect(leaveMessage(12)).toBe("You'll keep the 12 XP you've earned, but the lesson won't count as complete — you'll start it from the beginning next time.");
    expect(leaveMessage(0)).toBe("The lesson won't count as complete — you'll start it from the beginning next time.");
  });
});
