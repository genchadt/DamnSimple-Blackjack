// src/game/handmanager-ts
import { Card, Rank, Suit } from "./Card";
import { Deck } from "./Deck";

export class HandManager {
    private deck: Deck;
    private cardFlipCallbacks: Map<string, (card: Card) => void> = new Map();

    constructor(numDecks: number = 1) {
        this.deck = new Deck(numDecks);
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
            this.deck.reset();
        }
    }

    /**
     * Forces the deck to be reset and reshuffled immediately.
     * @returns The number of cards remaining after reshuffle.
     */
    public forceDeckReshuffle(): number {
        console.log("[HandManager] Forcing deck reshuffle via debug command.");
        this.deck.reset(); // Resets with the same number of decks
        return this.deck.getCardsRemaining();
    }

    /**
     * Gets the number of cards currently remaining in the deck.
     * @returns The number of cards remaining.
     */
    public getCardsRemainingInDeck(): number {
        return this.deck.getCardsRemaining();
    }

    /**
     * Gets a copy of the cards currently in the deck for debug inspection.
     * @returns An array of Card objects.
     */
    public getDeckCards(): Card[] {
        return this.deck.getCards();
    }

    /**
     * DEBUG: Sets the deck to contain only cards of rank '2'.
     */
    public setDeckToTwos(): void {
        this.deck.setDeckToTwos();
    }

    /**
     * DEBUG: Finds and draws a card that matches a specific rank and/or suit from the deck.
     * @param rank The rank to match.
     * @param suit The suit to match.
     * @returns The drawn card or undefined if not found.
     */
    public findAndDrawCard(rank?: Rank, suit?: Suit): Card | undefined {
        return this.deck.findAndDrawCard(rank, suit);
    }

    /**
     * Adds a callback function to be called when ANY card managed by this game is flipped.
     * The callback receives the card instance as an argument.
     * @param id A unique ID for the callback (e.g., 'cardVisualizer')
     * @param callback The function to be called when a card is flipped.
     */
    public addCardFlipCallback(id: string, callback: (card: Card) => void): void {
        this.cardFlipCallbacks.set(id, callback);
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
        console.log(`%c[HandManager] Registering flip callback for ${card.toString()}`, 'color: #B8860B');
        card.setFlipCallback((flippedCard) => {
            console.log(`%c[HandManager] Flip detected for ${flippedCard.toString()} (now ${flippedCard.isFaceUp() ? 'UP' : 'DOWN'}), notifying ${this.cardFlipCallbacks.size} listeners.`, 'color: #B8860B');
            this.cardFlipCallbacks.forEach((callback, id) => {
                try {
                    callback(flippedCard);
                } catch (e) {
                    console.error(`[HandManager] Error in flip callback '${id}':`, e);
                }
            });
        });
    }
}