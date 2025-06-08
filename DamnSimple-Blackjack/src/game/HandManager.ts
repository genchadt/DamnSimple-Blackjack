// src/game/handmanager-ts
import { Card } from "./Card";
import { Deck } from "./Deck";

export class HandManager {
    private deck: Deck;
    private cardFlipCallbacks: Map<string, (card: Card) => void> = new Map(); // Use Map for easier removal if needed

    constructor() {
        this.deck = new Deck(); // Using 1 deck by default
    }

    /**
     * Draws a card from the deck.
     * Returns undefined if the deck is empty (should ideally not happen with reshuffling).
     */
    public drawCard(): Card | undefined {
        return this.deck.drawCard();
    }

    /**
     * Resets and shuffles the deck if the number of cards remaining is low.
     */
    public refreshDeckIfNeeded(): void {
        if (this.deck.needsShuffle()) {
            this.deck.reset(); // Resets with the same number of decks it was initialized with
        }
    }

    /**
     * Adds a callback function to be called when ANY card managed by this game is flipped.
     * The callback receives the card instance as an argument.
     * @param id A unique ID for the callback (e.g., 'cardVisualizer')
     * @param callback The function to be called when a card is flipped.
     */
    public addCardFlipCallback(id: string, callback: (card: Card) => void): void {
        this.cardFlipCallbacks.set(id, callback);
        // console.log(`[HandManager] Registered flip callback with ID: ${id}`); // Reduce log noise
    }

    /**
     * Removes a previously registered card flip callback.
     * @param id The unique ID of the callback to remove.
     */
    public removeCardFlipCallback(id: string): void {
        this.cardFlipCallbacks.delete(id);
    }

    /**
     * Registers the global flip listeners onto a specific card instance.
     * This should be called whenever a card is created or restored.
     * @param card The card instance to register listeners on.
     */
    public registerFlipCallback(card: Card): void {
        // *** DEBUG LOG ADDED ***
        console.log(`%c[HandManager] Registering flip callback for ${card.toString()}`, 'color: #B8860B'); // DarkGoldenRod
        card.setFlipCallback((flippedCard) => {
            console.log(`%c[HandManager] Flip detected for ${flippedCard.toString()} (now ${flippedCard.isFaceUp() ? 'UP' : 'DOWN'}), notifying ${this.cardFlipCallbacks.size} listeners.`, 'color: #B8860B');
            this.cardFlipCallbacks.forEach((callback, id) => {
                // console.log(`Notifying listener: ${id}`);
                try {
                    callback(flippedCard);
                } catch (e) {
                    console.error(`[HandManager] Error in flip callback '${id}':`, e);
                }
            });
        });
    }

    // --- Methods removed as hands are managed by BlackjackGame ---
    // resetHands()
    // getPlayerHand()
    // getDealerHand()
    // dealInitialCards() -> Logic moved to GameActions
    // revealDealerHoleCard() -> Logic moved to GameActions (requestRevealDealerHoleCard)
}
