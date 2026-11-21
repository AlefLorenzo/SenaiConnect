/**
 * Story Cleanup Utility
 * Handles automatic expiration and cleanup of stories
 * Runs as a cron job to delete stories older than 24 hours
 */

const db = require('../db');
const fs = require('fs').promises;
const path = require('path');

/**
 * Delete expired stories (older than 24 hours)
 * Also removes associated highlights if they become empty
 * Deletes associated media files from disk
 */
async function cleanupExpiredStories() {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Find expired stories (created more than 24 hours ago) with media URLs
    const [expiredStories] = await connection.execute(`
      SELECT id, user_id, media_url
      FROM stories
      WHERE created_at < (NOW() - INTERVAL '24 hours')
    `);

    if (expiredStories.length === 0) {
      await connection.commit();
      console.log('[Story Cleanup] No expired stories found');
      return { deleted: 0, highlightsUpdated: 0, filesDeleted: 0 };
    }

    console.log(`[Story Cleanup] Found ${expiredStories.length} expired stories`);

    // Collect media URLs for file deletion
    const mediaFilesToDelete = expiredStories
      .filter(s => s.media_url)
      .map(s => s.media_url);

    // Collect story IDs to delete
    const storyIds = expiredStories.map(s => s.id);
    const placeholders = storyIds.map(() => '?').join(',');

    // Delete story views first (foreign key constraint)
    await connection.execute(
      `DELETE FROM story_views WHERE story_id IN (${placeholders})`,
      storyIds
    );

    // Delete story reactions
    await connection.execute(
      `DELETE FROM story_reactions WHERE story_id IN (${placeholders})`,
      storyIds
    );

    // Delete story replies
    await connection.execute(
      `DELETE FROM story_replies WHERE story_id IN (${placeholders})`,
      storyIds
    );

    // Delete story privacy exceptions
    await connection.execute(
      `DELETE FROM story_privacy_exceptions WHERE story_id IN (${placeholders})`,
      storyIds
    );

    // Delete stories from highlights
    await connection.execute(
      `DELETE FROM highlight_stories WHERE story_id IN (${placeholders})`,
      storyIds
    );

    // Delete the stories
    await connection.execute(
      `DELETE FROM stories WHERE id IN (${placeholders})`,
      storyIds
    );

    // Check for highlights that became empty and clean them up
    const [emptyHighlights] = await connection.execute(`
      SELECT h.id
      FROM highlights h
      LEFT JOIN highlight_stories hs ON h.id = hs.highlight_id
      WHERE hs.highlight_id IS NULL
    `);

    let highlightsUpdated = 0;
    if (emptyHighlights.length > 0) {
      const highlightIds = emptyHighlights.map(h => h.id);
      const hlPlaceholders = highlightIds.map(() => '?').join(',');
      await connection.execute(
        `DELETE FROM highlights WHERE id IN (${hlPlaceholders})`,
        highlightIds
      );
      highlightsUpdated = highlightIds.length;
      console.log(`[Story Cleanup] Removed ${highlightsUpdated} empty highlights`);
    }

    await connection.commit();
    console.log(`[Story Cleanup] Deleted ${storyIds.length} expired stories`);

    // Delete media files from disk (after commit to ensure consistency)
    let filesDeleted = 0;
    for (const mediaUrl of mediaFilesToDelete) {
      try {
        // Extract filename from URL (assuming format like /uploads/stories/filename.ext)
        const filename = path.basename(mediaUrl);
        const filePath = path.join(__dirname, '..', '..', 'uploads', 'stories', filename);
        await fs.unlink(filePath);
        filesDeleted++;
        console.log(`[Story Cleanup] Deleted media file: ${filename}`);
      } catch (fileError) {
        // File might not exist, log but don't fail the cleanup
        console.warn(`[Story Cleanup] Could not delete media file ${mediaUrl}:`, fileError.message);
      }
    }

    if (filesDeleted > 0) {
      console.log(`[Story Cleanup] Deleted ${filesDeleted} media files`);
    }

    return { deleted: storyIds.length, highlightsUpdated, filesDeleted };
  } catch (error) {
    await connection.rollback();
    console.error('[Story Cleanup] Error:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get stories expiring soon (within 1 hour)
 * Useful for sending expiration notifications
 */
async function getExpiringSoonStories() {
  const [stories] = await db.execute(`
    SELECT s.id, s.user_id, s.created_at, u.socket_id
    FROM stories s
    JOIN users u ON s.user_id = u.id
    WHERE s.created_at BETWEEN (NOW() - INTERVAL '25 hours') AND (NOW() - INTERVAL '24 hours')
    AND u.socket_id IS NOT NULL
  `);
  return stories;
}

/**
 * Start the story cleanup cron job
 * Runs every hour to clean up expired stories
 */
function startStoryCleanupCron(io) {
  // Run immediately on startup
  cleanupExpiredStories().catch(err => console.error('[Story Cleanup] Startup error:', err));

  // Schedule to run every hour
  const interval = setInterval(async () => {
    try {
      const result = await cleanupExpiredStories();

      // Emit socket event for real-time updates
      if (result.deleted > 0 && io) {
        io.emit('stories_expired', {
          count: result.deleted,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('[Story Cleanup] Cron error:', error);
    }
  }, 60 * 60 * 1000); // Every hour

  console.log('[Story Cleanup] Cron job started (runs every hour)');
  return interval;
}

/**
 * Stop the story cleanup cron job
 */
function stopStoryCleanupCron(interval) {
  if (interval) {
    clearInterval(interval);
    console.log('[Story Cleanup] Cron job stopped');
  }
}

module.exports = {
  cleanupExpiredStories,
  getExpiringSoonStories,
  startStoryCleanupCron,
  stopStoryCleanupCron,
};