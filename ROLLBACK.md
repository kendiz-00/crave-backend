# BulkClix SMS Provider Rollback Instructions

## Important Notes
- **DO NOT** use `SMS_PROVIDER=test` in production under any circumstances
- **DO NOT** force-push to main branch
- **DO NOT** switch to unverified Africa's Talking credentials in production
- Rollback should only be performed if critical issues are detected after deployment

## Rollback Procedure

### Option 1: Render Deployment Rollback (Recommended)

If issues occur after deploying BulkClix, roll back to the previous stable Render deployment:

1. **Go to Render Dashboard**
   - Navigate to the crave-backend service
   - Click on "Deploys" tab

2. **Identify Previous Stable Deployment**
   - Find the deployment before the BulkClix changes
   - Note the commit hash (e.g., `2561166` or earlier)

3. **Rollback Deployment**
   - Click on the previous stable deployment
   - Click "Rollback to this deploy"
   - Render will redeploy the previous version
   - Wait for deployment to complete (typically 2-5 minutes)

4. **Verify Rollback**
   - Check Render logs for successful deployment
   - Verify backend health endpoint returns 200
   - Test registration flow (should use previous SMS provider)

5. **Restore Environment Variables**
   - If environment variables were changed for BulkClix, restore previous values:
     - Remove `BULKCLIX_API_KEY`
     - Remove `BULKCLIX_SENDER_ID`
     - Restore `SMS_PROVIDER=africas_talking` (if previously used)
     - Restore `AFRICAS_TALKING_USERNAME` and `AFRICAS_TALKING_API_KEY` (if previously used)

### Option 2: Git Revert and Redeploy (If Option 1 Fails)

If Render rollback is not available or fails:

1. **Revert the BulkClix Commit**
   ```bash
   git checkout main
   git log --oneline -5  # Identify the BulkClix commit
   git revert <bulkclix-commit-hash>  # Creates a new commit reverting changes
   ```

2. **Push to Main**
   ```bash
   git push origin main
   ```

3. **Render Auto-Deploys**
   - Render will automatically deploy the revert commit
   - Wait for deployment to complete

4. **Restore Environment Variables**
   - Follow step 5 from Option 1

### Option 3: Emergency Disable SMS (Last Resort)

If SMS functionality must be disabled immediately:

1. **Disable SMS in Render**
   - Go to Render dashboard
   - Navigate to environment variables
   - Set `SMS_PROVIDER=disabled` (will cause provider factory to throw error)
   - OR comment out SMS-related environment variables

2. **Impact of This Option**
   - Registration will fail for new users (requires phone verification)
   - Existing users can still login with phone + password
   - This is a temporary measure only

## Post-Rollback Verification

After any rollback:

1. **Check Render Logs**
   - Verify no errors during deployment
   - Verify correct provider initialization (Africa's Talking or test)
   - Verify no BulkClix-related logs

2. **Test Registration Flow**
   - Visit registration page
   - Test phone verification
   - Verify SMS is sent (or logged if using test provider)

3. **Test Login Flow**
   - Test login with existing user
   - Verify authentication works

4. **Monitor for 24 Hours**
   - Watch Render logs for errors
   - Monitor user complaints about SMS issues
   - Verify SMS delivery rate is normal

## BulkClix API Response Handling Note

**Important:** A successful BulkClix API response (`HTTP 200` with `campaignId`) means:
- The request was **accepted** by BulkClix for processing
- The SMS has been **queued** for delivery
- It does **NOT guarantee** the SMS was delivered to the phone

**Delivery Verification:**
- BulkClix typically delivers SMS within 30 seconds
- If delivery fails, it may be due to:
  - Invalid phone number
  - Carrier network issues
  - Insufficient credits
  - Sender ID issues

**Monitoring:**
- Monitor Render logs for successful `campaignId` responses
- Monitor BulkClix dashboard for delivery reports
- Track user complaints about not receiving SMS

## Emergency Contacts

If rollback procedures fail or critical issues persist:
- Contact Render support for deployment assistance
- Contact BulkClix support for SMS delivery issues
- Check BulkClix dashboard for account status and credits
