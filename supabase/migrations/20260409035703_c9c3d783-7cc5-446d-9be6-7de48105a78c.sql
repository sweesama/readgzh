-- Delete articles that contain verification page content (garbage data)
DELETE FROM articles 
WHERE content LIKE '%环境异常%' 
  AND content LIKE '%去验证%' 
  AND content LIKE '%验证码%'
  AND length(content) < 500;

-- Delete articles that are actually error pages
DELETE FROM articles 
WHERE (content LIKE '%This mp.weixin.qq.com page can%t be found%' 
   OR content LIKE '%HTTP ERROR 404%'
   OR content LIKE '%No webpage was found%')
  AND length(content) < 2000;