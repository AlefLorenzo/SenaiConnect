const db = require('../db');

const ALLOWED_AD_LOCATIONS = [
    'global_feed',
    'business_feed_top',
    'business_feed_middle',
    'business_feed_bottom'
];

function parseJson(value, fallback = {}) {
    if (value && typeof value === 'object') return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' ? parsed : fallback;
        } catch {
            return fallback;
        }
    }
    return fallback;
}

function safeDestination(value) {
    const destination = String(value || '').trim();
    if (!destination || /^(javascript|data|file|vbscript):/i.test(destination)) return null;
    if (destination.startsWith('/') && !destination.startsWith('//') && !destination.includes('\\')) {
        return destination;
    }
    try {
        const parsed = new URL(destination);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
    } catch {
        return null;
    }
}

function asList(value) {
    if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
    if (value === undefined || value === null || value === '') return [];
    return [String(value).trim()].filter(Boolean);
}

function matchesAudience(rawAudience, user) {
    const audience = parseJson(rawAudience);
    const courseValues = asList(audience.courses ?? audience.course);
    const unitValues = asList(audience.units ?? audience.unit);
    const roleValues = asList(audience.roles ?? audience.role);
    const matches = (values, current) => !values.length || values.some(value =>
        value.toLowerCase() === String(current || '').trim().toLowerCase()
    );

    return matches(courseValues, user.course)
        && matches(unitValues, user.unit)
        && matches(roleValues, user.role);
}

function dateValue(value) {
    const timestamp = new Date(value || 0).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

const discoveryFeedController = {
    list: async (req, res) => {
        try {
            const userId = req.user.id;
            const page = Math.max(1, Math.min(20, Number.parseInt(req.query.page, 10) || 1));
            const limit = Math.max(1, Math.min(20, Number.parseInt(req.query.limit, 10) || 10));
            const take = page * limit;
            const offset = (page - 1) * limit;
            const search = String(req.query.search || '').trim();
            const postType = String(req.query.postType || '').trim();
            const category = String(req.query.category || '').trim();
            const feedType = String(req.query.feedType || 'all').toLowerCase();
            const sort = ['popular', 'oldest'].includes(req.query.sort) ? req.query.sort : 'recent';

            const [userRows] = await db.query(
                'SELECT course, unit, role FROM users WHERE id = ? LIMIT 1',
                [userId]
            );
            const viewer = userRows[0] || {};

            const businessEnabled = ['all', 'business', 'businesses', 'companies', 'opportunities'].includes(feedType);
            const institutionsEnabled = ['all', 'institution', 'institutions', 'events', 'courses'].includes(feedType);
            const adsEnabled = ['all', 'ads', 'advertising', 'sponsored'].includes(feedType);

            let businessPosts = [];
            if (businessEnabled) {
                let where = "WHERE bp.status = 'published' AND b.status = 'approved'";
                const params = [userId, userId];
                if (search) {
                    where += ' AND (bp.content LIKE ? OR bp.category LIKE ? OR b.company_name LIKE ?)';
                    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
                }
                if (postType) {
                    where += ' AND bp.post_type = ?';
                    params.push(postType);
                }
                if (category) {
                    where += ' AND bp.category = ?';
                    params.push(category);
                }
                if (feedType === 'opportunities') {
                    where += " AND bp.post_type IN ('job', 'internship')";
                }

                const orderBy = sort === 'popular'
                    ? '(bp.likes_count + bp.comments_count * 2 + bp.shares_count) DESC, bp.published_at DESC'
                    : sort === 'oldest' ? 'bp.published_at ASC' : 'bp.published_at DESC';

                const [rows] = await db.query(`
                    SELECT bp.*, b.company_name, b.logo_url, b.slug AS business_slug,
                        EXISTS(SELECT 1 FROM business_post_likes WHERE post_id = bp.id AND user_id = ?) AS liked,
                        EXISTS(SELECT 1 FROM business_post_saves WHERE post_id = bp.id AND user_id = ?) AS saved
                    FROM business_posts bp
                    JOIN businesses b ON b.id = bp.business_id
                    ${where}
                    ORDER BY ${orderBy}
                    LIMIT ?
                `, [...params, take]);
                businessPosts = rows.map(post => ({
                    ...post,
                    feed_type: 'business_post',
                    source_type: 'business',
                    external_link: safeDestination(post.external_link),
                    carousel_images: parseJson(post.carousel_images, [])
                }));
                businessPosts.forEach(post => {
                    if (!Array.isArray(post.carousel_images)) post.carousel_images = [];
                });
            }

            let events = [];
            let courses = [];
            if (institutionsEnabled) {
                if (feedType === 'all' || feedType === 'institution' || feedType === 'institutions' || feedType === 'events') {
                    let eventWhere = "WHERE LOWER(e.status) IN ('ativo', 'active', 'published') AND e.event_date >= NOW()";
                    const eventParams = [];
                    if (search) {
                        eventWhere += ' AND (e.title LIKE ? OR e.description LIKE ? OR e.unit LIKE ?)';
                        eventParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
                    }
                    if (category) {
                        eventWhere += ' AND e.category = ?';
                        eventParams.push(category);
                    }
                    const [rows] = await db.query(`
                        SELECT e.id, e.title, e.description, e.event_date, e.event_time, e.location,
                            e.unit, e.category, e.image_url, e.created_at, e.status,
                            u.name AS author_name, u.avatar AS author_avatar
                        FROM events e
                        LEFT JOIN users u ON u.id = e.author_id
                        ${eventWhere}
                        ORDER BY e.created_at DESC
                        LIMIT ?
                    `, [...eventParams, take]);
                    events = rows.map(event => ({
                        ...event,
                        id: `event-${event.id}`,
                        entity_id: event.id,
                        feed_type: 'institutional',
                        institution_type: 'event',
                        source_type: 'institution',
                        company_name: event.author_name || 'Instituição',
                        logo_url: event.author_avatar || null,
                        post_type: 'event',
                        content: event.description || '',
                        attachment_url: event.image_url || null,
                        attachment_type: 'image',
                        published_at: event.created_at,
                        external_link: '/events',
                        link_label: 'Ver evento'
                    }));
                }

                if (feedType === 'all' || feedType === 'institution' || feedType === 'institutions' || feedType === 'courses') {
                    let courseWhere = "WHERE LOWER(c.status) IN ('ativo', 'active', 'published')";
                    const courseParams = [];
                    if (search) {
                        courseWhere += ' AND (c.title LIKE ? OR c.description LIKE ? OR c.area LIKE ? OR c.unit LIKE ?)';
                        courseParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
                    }
                    if (category) {
                        courseWhere += ' AND (c.area = ? OR c.unit = ?)';
                        courseParams.push(category, category);
                    }
                    const [rows] = await db.query(`
                        SELECT c.id, c.title, c.description, c.unit, c.area, c.duration, c.modality,
                            c.period, c.vacancies, c.enrollment_info, c.image_url, c.created_at, c.status,
                            u.name AS author_name, u.avatar AS author_avatar
                        FROM courses c
                        LEFT JOIN users u ON u.id = c.author_id
                        ${courseWhere}
                        ORDER BY c.created_at DESC
                        LIMIT ?
                    `, [...courseParams, take]);
                    courses = rows.map(course => ({
                        ...course,
                        id: `course-${course.id}`,
                        entity_id: course.id,
                        feed_type: 'institutional',
                        institution_type: 'course',
                        source_type: 'institution',
                        company_name: course.author_name || 'Instituição',
                        logo_url: course.author_avatar || null,
                        post_type: 'course',
                        content: course.description || '',
                        attachment_url: course.image_url || null,
                        attachment_type: 'image',
                        category: course.area || 'Educação',
                        published_at: course.created_at,
                        external_link: '/courses',
                        link_label: 'Conhecer curso'
                    }));
                }
            }

            let campaignAds = [];
            if (adsEnabled) {
                let campaignWhere = `
                    WHERE cc.status = 'approved'
                      AND bc.status IN ('approved', 'active')
                      AND bc.start_date <= NOW()
                      AND bc.end_date >= NOW()
                      AND b.status = 'approved'
                      AND a.is_active = TRUE
                      AND a.location = ANY(?)
                `;
                const campaignParams = [ALLOWED_AD_LOCATIONS];
                if (search) {
                    campaignWhere += ' AND (cc.title LIKE ? OR cc.description LIKE ? OR b.company_name LIKE ?)';
                    campaignParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
                }

                const [rows] = await db.query(`
                    SELECT cc.id AS creative_id, cc.title, cc.description, cc.image_url,
                        cc.destination_url, cc.status AS creative_status,
                        bc.id AS campaign_id, bc.name AS campaign_name, bc.target_audience,
                        bc.start_date, bc.end_date, bc.created_at,
                        b.id AS business_id, b.company_name, b.logo_url, b.slug AS business_slug,
                        a.id AS ad_space_id, a.frequency_cap
                    FROM campaign_creatives cc
                    JOIN business_campaigns bc ON bc.id = cc.campaign_id
                    JOIN businesses b ON b.id = bc.business_id
                    JOIN ad_spaces a ON a.id = cc.ad_space_id
                    ${campaignWhere}
                    ORDER BY bc.created_at DESC
                    LIMIT ?
                `, [...campaignParams, take]);

                campaignAds = rows
                    .filter(ad => matchesAudience(ad.target_audience, viewer))
                    .map(ad => ({
                        ...ad,
                        id: `campaign-ad-${ad.creative_id}`,
                        feed_type: 'campaign_ad',
                        source_type: 'business',
                        is_sponsored: true,
                        external_link: safeDestination(ad.destination_url),
                        link_label: 'Saiba mais',
                        post_type: 'sponsored',
                        published_at: ad.created_at,
                        content: ad.description || '',
                        attachment_url: ad.image_url,
                        attachment_type: 'image'
                    }))
                    .filter(ad => ad.external_link);
            }

            const organicItems = [...businessPosts, ...events, ...courses];
            const sortItems = (items) => items.sort((a, b) => {
                if (sort === 'popular') {
                    const scoreA = Number(a.likes_count || 0) + Number(a.comments_count || 0) * 2 + Number(a.shares_count || 0);
                    const scoreB = Number(b.likes_count || 0) + Number(b.comments_count || 0) * 2 + Number(b.shares_count || 0);
                    if (scoreA !== scoreB) return scoreB - scoreA;
                }
                const direction = sort === 'oldest' ? 1 : -1;
                return direction * (dateValue(a.published_at || a.created_at) - dateValue(b.published_at || b.created_at));
            });
            sortItems(organicItems);
            sortItems(campaignAds);

            let mixedItems;
            if (feedType === 'ads' || feedType === 'advertising' || feedType === 'sponsored') {
                mixedItems = campaignAds;
            } else if (feedType === 'business' || feedType === 'businesses' || feedType === 'companies' || feedType === 'opportunities') {
                mixedItems = organicItems;
            } else if (feedType === 'institution' || feedType === 'institutions' || feedType === 'events' || feedType === 'courses') {
                mixedItems = organicItems;
            } else {
                mixedItems = [];
                let adIndex = 0;
                organicItems.forEach((item, index) => {
                    mixedItems.push(item);
                    if ((index + 1) % 4 === 0 && adIndex < campaignAds.length) {
                        mixedItems.push(campaignAds[adIndex]);
                        adIndex += 1;
                    }
                });
                while (adIndex < campaignAds.length && organicItems.length === 0) {
                    mixedItems.push(campaignAds[adIndex]);
                    adIndex += 1;
                }
            }

            const items = mixedItems.slice(offset, offset + limit);
            const hasMore = mixedItems.length > offset + limit
                || businessPosts.length === take
                || events.length === take
                || courses.length === take
                || campaignAds.length === take;

            return res.json({
                items,
                pagination: {
                    page,
                    limit,
                    hasMore
                }
            });
        } catch (error) {
            console.error('Erro ao carregar feed de descoberta:', error);
            return res.status(500).json({ error: 'Não foi possível carregar o feed de descoberta.' });
        }
    },

    trackImpression: async (req, res) => {
        try {
            const userId = req.user.id;
            const creativeId = Number.parseInt(req.params.id, 10);
            if (!Number.isInteger(creativeId) || creativeId <= 0) {
                return res.status(400).json({ error: 'Anúncio inválido.' });
            }

            const [rows] = await db.query(`
                SELECT cc.id, cc.campaign_id, bc.business_id, cc.ad_space_id, bc.target_audience
                FROM campaign_creatives cc
                JOIN business_campaigns bc ON bc.id = cc.campaign_id
                JOIN businesses b ON b.id = bc.business_id
                JOIN ad_spaces a ON a.id = cc.ad_space_id
                WHERE cc.id = ? AND cc.status = 'approved'
                  AND bc.status IN ('approved', 'active')
                  AND bc.start_date <= NOW() AND bc.end_date >= NOW()
                  AND b.status = 'approved' AND a.is_active = TRUE
                  AND a.location = ANY(?)
                LIMIT 1
            `, [creativeId, ALLOWED_AD_LOCATIONS]);
            const creative = rows[0];
            if (!creative) return res.status(404).json({ error: 'Anúncio indisponível.' });

            const [userRows] = await db.query('SELECT course, unit, role FROM users WHERE id = ? LIMIT 1', [userId]);
            if (!matchesAudience(creative.target_audience, userRows[0] || {})) {
                return res.status(404).json({ error: 'Anúncio indisponível.' });
            }

            const [existing] = await db.query(`
                SELECT id FROM ad_impressions
                WHERE creative_id = ? AND user_id = ?
                  AND viewed_at >= NOW() - INTERVAL '24 hours'
                ORDER BY viewed_at DESC
                LIMIT 1
            `, [creativeId, userId]);
            if (existing.length) return res.json({ tracked: false, impression_id: existing[0].id });

            const [inserted] = await db.query(`
                INSERT INTO ad_impressions (creative_id, campaign_id, business_id, ad_space_id, user_id)
                VALUES (?, ?, ?, ?, ?)
                RETURNING id
            `, [creativeId, creative.campaign_id, creative.business_id, creative.ad_space_id, userId]);
            const impressionId = inserted?.rows?.[0]?.id || inserted?.insertId || null;
            await db.query('UPDATE business_campaigns SET impressions_count = impressions_count + 1 WHERE id = ?', [creative.campaign_id]);

            return res.status(201).json({ tracked: true, impression_id: impressionId });
        } catch (error) {
            console.error('Erro ao registrar impressão do anúncio:', error);
            return res.status(500).json({ error: 'Não foi possível registrar a impressão.' });
        }
    },

    trackClick: async (req, res) => {
        try {
            const userId = req.user.id;
            const creativeId = Number.parseInt(req.params.id, 10);
            const impressionId = Number.parseInt(req.body?.impression_id, 10);
            if (!Number.isInteger(creativeId) || creativeId <= 0) {
                return res.status(400).json({ error: 'Anúncio inválido.' });
            }
            if (!Number.isInteger(impressionId) || impressionId <= 0) {
                return res.status(400).json({ error: 'Impressão não encontrada.' });
            }

            const [impressions] = await db.query(`
                SELECT id, campaign_id FROM ad_impressions
                WHERE id = ? AND creative_id = ? AND user_id = ?
                LIMIT 1
            `, [impressionId, creativeId, userId]);
            if (!impressions.length) return res.status(404).json({ error: 'Impressão não encontrada.' });

            const [existing] = await db.query(
                'SELECT id FROM ad_clicks WHERE impression_id = ? LIMIT 1',
                [impressionId]
            );
            if (existing.length) return res.json({ tracked: false });

            const [creativeRows] = await db.query(`
                SELECT cc.campaign_id, bc.business_id, cc.ad_space_id
                FROM campaign_creatives cc
                JOIN business_campaigns bc ON bc.id = cc.campaign_id
                WHERE cc.id = ? AND bc.status IN ('approved', 'active')
            `, [creativeId]);
            if (!creativeRows.length) return res.status(404).json({ error: 'Anúncio indisponível.' });

            await db.query(`
                INSERT INTO ad_clicks (impression_id, creative_id, campaign_id, business_id, ad_space_id, user_id)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                impressionId,
                creativeId,
                creativeRows[0].campaign_id,
                creativeRows[0].business_id,
                creativeRows[0].ad_space_id,
                userId
            ]);
            await db.query(`
                UPDATE business_campaigns
                SET clicks_count = clicks_count + 1,
                    ctr = CASE WHEN impressions_count > 0
                        THEN ROUND(((clicks_count + 1)::numeric / impressions_count) * 100, 4)
                        ELSE 0 END
                WHERE id = ?
            `, [creativeRows[0].campaign_id]);

            return res.json({ tracked: true });
        } catch (error) {
            console.error('Erro ao registrar clique no anúncio:', error);
            return res.status(500).json({ error: 'Não foi possível registrar o clique.' });
        }
    }
};

module.exports = discoveryFeedController;
