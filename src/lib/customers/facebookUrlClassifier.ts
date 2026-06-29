export type FacebookUrlType = 
  | 'PROFILE' 
  | 'PAGE' 
  | 'GROUP' 
  | 'POST' 
  | 'REEL' 
  | 'STORY' 
  | 'MESSENGER' 
  | 'INVALID' 
  | 'UNKNOWN';

export interface FacebookUrlClassification {
  type: FacebookUrlType;
  username: string | null;
  uid: string | null;
  normalizedUrl: string | null;
}

export function classifyFacebookUrl(url: string): FacebookUrlClassification {
  const result: FacebookUrlClassification = {
    type: 'UNKNOWN',
    username: null,
    uid: null,
    normalizedUrl: null
  };

  if (!url || typeof url !== 'string') {
    result.type = 'INVALID';
    return result;
  }

  let cleanUrl = url.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl;
  }
  
  try {
    const urlObj = new URL(cleanUrl);
    const hostname = urlObj.hostname.toLowerCase();
    
    if (!hostname.includes('facebook.com') && !hostname.includes('fb.com') && !hostname.includes('fb.me') && !hostname.includes('m.me')) {
      result.type = 'INVALID';
      return result;
    }

    if (hostname.includes('m.me')) {
      result.type = 'MESSENGER';
      return result;
    }
    
    const pathname = urlObj.pathname.toLowerCase();
    
    if (pathname.startsWith('/groups/')) {
      result.type = 'GROUP';
      return result;
    }
    if (pathname.startsWith('/posts/') || pathname.includes('/posts/')) {
      result.type = 'POST';
      return result;
    }
    if (pathname.startsWith('/reel/')) {
      result.type = 'REEL';
      return result;
    }
    if (pathname.startsWith('/stories/') || pathname.startsWith('/story.php')) {
      result.type = 'STORY';
      return result;
    }
    if (pathname.startsWith('/messages/')) {
      result.type = 'MESSENGER';
      return result;
    }
    if (pathname.startsWith('/pages/')) {
      result.type = 'PAGE';
      return result;
    }
    if (pathname.startsWith('/watch')) {
      result.type = 'POST';
      return result;
    }
    if (pathname.startsWith('/photo.php') || pathname.startsWith('/video.php')) {
      result.type = 'POST';
      return result;
    }
    
    if (pathname === '/profile.php') {
      const id = urlObj.searchParams.get('id');
      if (id && /^\d+$/.test(id)) {
        result.type = 'PROFILE';
        result.uid = id;
        result.normalizedUrl = `https://facebook.com/profile.php?id=${id}`;
        return result;
      }
    }
    
    const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
    if (pathParts.length > 0 && pathParts[0] !== 'p') {
      const username = pathParts[0];
      const reserved = ['home.php', 'login.php', 'watch', 'marketplace', 'gaming', 'events', 'jobs', 'campaign', 'people'];
      if (!reserved.includes(username.toLowerCase())) {
        if (/^\d+$/.test(username)) {
           result.type = 'PROFILE';
           result.uid = username;
           result.normalizedUrl = `https://facebook.com/profile.php?id=${username}`;
           return result;
        }
        result.type = 'PROFILE'; 
        result.username = username;
        result.normalizedUrl = `https://facebook.com/${username}`;
        return result;
      }
    }
    
    return result;
  } catch (e) {
    result.type = 'INVALID';
    return result;
  }
}
