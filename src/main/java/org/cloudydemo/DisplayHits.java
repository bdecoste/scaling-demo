package org.cloudydemo;

import java.util.Map;

import javax.ejb.EJB;
import javax.ejb.Stateless;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

import com.mongodb.util.JSON;

@Path("/display")
@Stateless
public class DisplayHits {
	@EJB
	private HitTracker hitTracker;
	
	long lastCheckTime = System.currentTimeMillis();

	@GET
	@Produces(MediaType.TEXT_PLAIN)
	public String getHits() {
		Map<String, Integer> hits = hitTracker.displayHitsSince(lastCheckTime);
		lastCheckTime = System.currentTimeMillis();
		return JSON.serialize(hits);
	}
}