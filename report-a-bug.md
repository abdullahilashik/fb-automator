curl --location 'https://dealercore.test/api/admin/ask' \
--header 'Accept: application/json' \
--header 'Content-Type: multipart/form-data; boundary=<calculated when request is sent>' \
--header 'Authorization: Bearer token' \


--form 'type="report_issue"' \
--form 'message="from deal view"' \
--form 'urgency="sadfa"' \
--form 'category="fasdf"' \
--form 'user_id="79"' \
--form 'rating="2"' \
--form 'feature_title="fsdafa"' \
--form 'plm_solved="fdsafa"' \
--form 'priority="sdaf"' \
--form 'urgency="asdfa"' \
--form 'issue_date=""' \
--form 'user_id="9"'



Dropdown Report Issue Field
Text area for message
Category
User Id from auth
rating
feature_title
plm_solved
priority
issue_date