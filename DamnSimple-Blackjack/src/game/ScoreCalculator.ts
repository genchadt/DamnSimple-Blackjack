// game/ScoreCalculator.ts
import { Card } from "./Card";

export class ScoreCalculator {
    /**
     * Calculates the total value of a hand in Blackjack, optimally valuing Aces as either 1 or 11.
     * Only considers face-up cards in the hand.
     */
    public static calculateHandValue(hand: Card[]): number {
        let value = 0;
        let aces = 0;
        
        // Count all non-ace cards first
        for (const card of hand) {
            if (card.isFaceUp()) {
                if (card.getRank() === "A") {
                    aces++;
                } else {
                    value += card.getValue();
                }
            }
        }
        
        // Handle aces optimally
        for (let i = 0; i < aces; i++) {
            if (value + 11 <= 21) {
                value += 11;
            } else {
                value += 1;
            }
        }
        
        return value;
    }

    /**
     * Determines if the player can split their hand.
     */
    public static canSplit(playerHand: Card[], playerFunds: number, currentBet: number): boolean {
        return playerHand.length === 2 && 
               playerHand[0].getValue() === playerHand[1].getValue() &&
               playerFunds >= currentBet;
    }
}
