package org.cloudydemo;

public interface HitTracker {
	public void addHit();
	public int displayHitsSince(long time);
}
