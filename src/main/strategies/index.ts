import { TimeStrategy } from './time';
import { TypeStrategy } from './type';
import { TopicStrategy } from './topic';

export const strategies = [
    TimeStrategy,
    TypeStrategy,
    new TopicStrategy() // Class-based because it holds client state
];

export function getStrategy(id: string) {
    return strategies.find(s => s.id === id);
}

