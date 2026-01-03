// src/components/FeedbackModal.jsx
import { useState, useEffect } from 'react';

export default function FeedbackModal({ event, existingFeedback, onSubmit, onClose }) {
  const [rating, setRating] = useState(existingFeedback?.rating || 0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState(existingFeedback?.comment || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (rating === 0) {
      alert('Please select a rating');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({ rating, comment });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const StarRating = () => {
    return (
      <div className="flex items-center gap-2 justify-center py-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoveredRating(star)}
            onMouseLeave={() => setHoveredRating(0)}
            className="text-5xl transition-all transform hover:scale-110 focus:outline-none"
          >
            {(hoveredRating >= star || rating >= star) ? (
              <span className="text-yellow-400">⭐</span>
            ) : (
              <span className="text-gray-600">☆</span>
            )}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-mid-dark rounded-lg max-w-lg w-full p-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-light">
            📝 Event Feedback
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition text-light/60 hover:text-light"
          >
            ✕
          </button>
        </div>

        {/* Event Info */}
        <div className="bg-dark/50 rounded-lg p-4 mb-6">
          <p className="text-light font-semibold">{event.title}</p>
          <p className="text-light/60 text-sm mt-1">
            {new Date(event.date).toLocaleDateString()}
            {event.startTime && ` at ${event.startTime}`}
          </p>
        </div>

        {/* Feedback Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Star Rating */}
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2 text-center">
              How was this event?
            </label>
            <StarRating />
            {rating > 0 && (
              <p className="text-center text-light/60 text-sm">
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very Good'}
                {rating === 5 && 'Excellent'}
              </p>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">
              Additional Comments (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your thoughts about the event..."
              rows={4}
              className="w-full px-4 py-3 bg-dark border border-white/10 rounded-lg text-light placeholder-light/40 focus:outline-none focus:border-primary transition resize-none"
            />
          </div>

          {/* Anonymous Notice */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="text-xs text-blue-300 flex items-center gap-2">
              <span>🔒</span>
              <span>Your feedback is anonymous. Only ratings and comments are visible to trainers.</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-dark hover:bg-dark/80 text-light rounded-lg transition font-medium"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-medium disabled:opacity-50"
              disabled={loading || rating === 0}
            >
              {loading ? 'Submitting...' : existingFeedback ? 'Update Feedback' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

