package com.brcommunity.androidhelper;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import androidx.test.ext.junit.runners.AndroidJUnit4;

import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class ChromeSessionPolicyInstrumentationTest {
  @Test
  public void acceptsOnlyAllowedHttpsHosts() {
    assertEquals("https://www.youtube.com/watch?v=abc", ChromeSessionPolicy.normalizeUrl("https://WWW.YouTube.com/watch?v=abc"));
    assertEquals("https://youtu.be/abc", ChromeSessionPolicy.normalizeUrl("https://youtu.be/abc"));
    assertEquals("https://www.instagram.com/reel/abc", ChromeSessionPolicy.normalizeUrl("https://www.instagram.com/reel/abc"));
  }

  @Test
  public void rejectsUnsafeOrUnapprovedUrls() {
    assertNull(ChromeSessionPolicy.normalizeUrl("http://www.youtube.com/watch?v=abc"));
    assertNull(ChromeSessionPolicy.normalizeUrl("https://evil.example/watch?v=abc"));
    assertNull(ChromeSessionPolicy.normalizeUrl("https://user:password@www.youtube.com/watch?v=abc"));
    assertNull(ChromeSessionPolicy.normalizeUrl("https://www.youtube.com:444/watch?v=abc"));
  }

  @Test
  public void urlMatchingIsExactAfterNormalization() {
    assertTrue(ChromeSessionPolicy.urlMatches(
        "https://WWW.YOUTUBE.COM/watch?v=abc",
        "https://www.youtube.com/watch?v=abc"));
    assertTrue(!ChromeSessionPolicy.urlMatches(
        "https://www.youtube.com/watch?v=abc",
        "https://www.youtube.com/watch?v=def"));
  }
}
