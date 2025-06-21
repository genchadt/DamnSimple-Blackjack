// src/game/Card.ts
/** Defines the suits of a standard playing card. */
export enum Suit {
    Hearts = "Hearts",
    Diamonds = "Diamonds",
    Clubs = "Clubs",
    Spades = "Spades"
}

/** Defines the ranks of a standard playing card. */
export enum Rank {
    Two = "2",
    Three = "3",
    Four = "4",
    Five = "5",
    Six = "6",
    Seven = "7",
    Eight = "8",
    Nine = "9",
    Ten = "10",
    Jack = "J",
    Queen = "Q",
    King = "K",
    Ace = "A"
}

/**
 * Represents a playing card with a suit and rank.
 * Cards can be flipped to change their face-up state.
 * Each card instance has a unique identifier for tracking.
 */
export class Card {
    private suit: Suit;
    private rank: Rank;
    private faceUp: boolean;
    private _uniqueId: string;

    /**
     * Callback function that gets called when this card instance is flipped.
     * This can be used to update UI or game state.
     */
    public onFlip: ((card: Card) => void) | null = null;

    /**
     * Creates a new Card instance with the specified suit and rank.
     * Cards are typically created face down initially.
     * @param suit The suit of the card (e.g., Hearts, Diamonds, Clubs, Spades).
     * @param rank The rank of the card (e.g., "2", "3", ..., "10", "J", "Q", "K", "A").
     */
    constructor(suit: Suit, rank: Rank) {
        this.suit = suit;
        this.rank = rank;
        this.faceUp = false; // Cards are typically created face down initially
        // Generate a unique ID using suit, rank, timestamp, and random number
        this._uniqueId = `${suit}-${rank}-${Date.now()}-${Math.random()}`;
    }

    /**
     * Gets a unique identifier for this card instance.
     * This ID is unique per instance and can be used to track the card in the game.
     * @returns A unique string identifier for this card.
     */
    public getUniqueId(): string {
        return this._uniqueId;
    }

    /**
     * Gets the suit of the card.
     * @return The suit of the card (e.g., Hearts, Diamonds, Clubs, Spades).
     *
     */
    public getSuit(): Suit {
        return this.suit;
    }

    /**
     * Gets the rank of the card.
     * @return The rank of the card as a Rank enum value.
     */
    public getRank(): Rank {
        return this.rank;
    }

    /**
     * Gets the CardMeister Card ID (cid) format (e.g., "Qh", "Td", "As").
     * @returns The cid string.
     */
    public getCid(): string {
        const rankChar = this.rank === Rank.Ten ? 'T' : this.rank[0].toUpperCase(); // T for Ten, first letter otherwise
        const suitChar = this.suit[0].toLowerCase(); // h, d, c, s
        return `${rankChar}${suitChar}`;
    }


    /**
     * Gets the numeric rank value used specifically for texture filenames.
     * Ace=1, 2-10, Jack=11, Queen=12, King=13.
     * @returns The numeric rank value for texture mapping.
     * @deprecated This might not be needed if fully switching to SVG. Keep for reference or potential fallback.
     */
    public getRankValueForTexture(): number {
        switch (this.rank) {
            case Rank.Ace: return 1;
            case Rank.Jack: return 11;
            case Rank.Queen: return 12;
            case Rank.King: return 13;
            default: return parseInt(this.rank); // Handles "2" through "10"
        }
    }

    /**
     * Checks if the card is currently face up.
     * @returns True if the card is face up, false if it is face down.
     */
    public isFaceUp(): boolean {
        return this.faceUp;
    }

    /**
     * Directly sets the face-up state of the card without triggering the onFlip callback.
     * Used primarily for initialization or restoring state.
     * @param value The desired face-up state (true for face up, false for face down).
     */
    public setFaceUp(value: boolean): void {
        // *** DEBUG LOG ADDED ***
        if (this.faceUp !== value) {
            // console.log(`%c[Card] ${this.toString()} setFaceUp(${value}) called. Previous state: ${this.faceUp}`, 'color: #FF8C00'); // DarkOrange
        }
        // No flip notification here, this is for setting initial state
        this.faceUp = value;
    }

    /**
     * Flips the card, changing its face-up state.
     */
    public flip(): void {
        const previousState = this.faceUp;
        this.faceUp = !this.faceUp;
        // *** DEBUG LOG ADDED ***
        // console.log(`%c[Card] ${this.toString()} flip() called. New state: ${this.faceUp}. Notifying listeners...`, 'color: #FF8C00'); // DarkOrange
        if (this.onFlip) {
            this.onFlip(this); // Notify listeners about the flip
        } else {
            // console.warn(`Card ${this.toString()} flipped, but no onFlip callback registered.`); // Reduce log noise
        }
    }

    /**
     * Registers a callback function to be called when this card instance is flipped.
     * @param callback The function to call, receiving this Card instance as an argument.
     */
    public setFlipCallback(callback: (card: Card) => void): void {
        this.onFlip = callback;
    }

    /**
     * Gets the Blackjack game value of the card.
     * Ace is 11 (can be adjusted later), face cards are 10, number cards are their number.
     * @returns The numeric value of the card in Blackjack.
     */
    public getValue(): number {
        switch (this.rank) {
            case Rank.Ace: return 11; // Ace is initially 11
            case Rank.Jack:
            case Rank.Queen:
            case Rank.King: return 10; // Face cards are 10
            default:
                // For ranks "2" through "10", parse the string to an integer
                const numericRank = parseInt(this.rank);
                // Return the parsed number, or 0 if parsing fails (shouldn't happen with valid Ranks)
                return isNaN(numericRank) ? 0 : numericRank;
        }
    }

    /**
     * Returns a string representation of the card in the format "Rank of Suit".
     * For example, "Ace of Hearts", "10 of Diamonds".
     * @return A string representation of the card.
     */
    public toString(): string {
        return `${this.rank} of ${this.suit}`;
    }
}
