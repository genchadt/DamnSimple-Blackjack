// src/game/scorecalculator-ts (Removed canSplit)
import { Card } from "./Card";

export class ScoreCalculator {
    /**
     * Calculates the total value of a hand in Blackjack, optimally valuing Aces as either 1 or 11.
     * Considers ALL cards in the hand, regardless of face-up state.
     *
     * @param hand - The hand of cards to calculate the value for.
     * @returns The total value of the hand. Returns 0 for an empty hand.
     */
    public static calculateHandValue(hand: Card[]): number {
        if (!hand || hand.length === 0) {
            return 0;
        }

        let value = 0;
        let aceCount = 0;

        for (const card of hand) {
            const cardValue = card.getValue();
            if (card.getRank() === "A") {
                aceCount++;
                value += 11; // Add Ace as 11 initially
            } else {
                value += cardValue;
            }
        }

        // Adjust Ace value from 11 to 1 if score exceeds 21
        while (value > 21 && aceCount > 0) {
            value -= 10; // Change one Ace from 11 to 1
            aceCount--;
        }

        return value;
    }

    // Removed canSplit method
}
